#!/usr/bin/env python3
"""Turn every runs/<harness>-<task>-<rep>/ into one row of metrics.

  python3 tools/analyze.py            → prints a table, writes results/runs.csv and results/runs.json
"""
import csv, json, sys
from collections import Counter
from pathlib import Path

Q = Path(__file__).resolve().parent.parent
EDIT_TOOLS = {'edit', 'Edit', 'MultiEdit', 'write', 'Write', 'apply_patch', 'hashline_edit'}


def lines(p):
    if not p.exists():
        return
    for l in p.read_text(errors='replace').splitlines():
        try:
            yield json.loads(l)
        except Exception:
            pass


def blank():
    return {'model_calls': 0, 'tool_calls': Counter(), 'tool_errors': Counter(), 'input_tokens': 0, 'output_tokens': 0,
            'cache_read_tokens': 0, 'provider_errors': 0, 'retries': 0, 'first_prompt_tokens': None}


def pi_like(path, m):
    """Pi and OMP --mode json: message_end events carry full messages."""
    for j in lines(path):
        if j.get('type') != 'message_end':
            continue
        msg = j['message']
        role = msg.get('role')
        if role == 'assistant':
            m['model_calls'] += 1
            u = msg.get('usage') or {}
            m['input_tokens'] += u.get('input', 0)
            m['output_tokens'] += u.get('output', 0)
            m['cache_read_tokens'] += u.get('cacheRead', 0)
            if m['first_prompt_tokens'] is None and u:
                m['first_prompt_tokens'] = u.get('input', 0) + u.get('cacheRead', 0)
            if msg.get('stopReason') == 'error':
                m['provider_errors'] += 1
            for b in msg.get('content') or []:
                if b.get('type') == 'toolCall':
                    m['tool_calls'][b['name']] += 1
        elif role == 'toolResult' and msg.get('isError'):
            m['tool_errors'][msg.get('toolName', '?')] += 1
        if j.get('type') == 'auto_retry_start':
            m['retries'] += 1
    for j in lines(path):
        if j.get('type') in ('auto_retry_start', 'retry'):
            m['retries'] += 1


def claude(path, m):
    pending = {}
    seen_msgs = set()
    for j in lines(path):
        t = j.get('type')
        if t == 'system' and j.get('subtype') == 'api_retry':
            m['retries'] += 1
        elif t == 'assistant':
            msg = j['message']
            mid = msg.get('id')
            u = msg.get('usage') or {}
            if mid not in seen_msgs:  # one API response can be split over several events
                seen_msgs.add(mid)
                m['model_calls'] += 1
            if True:
                first = (u.get('input_tokens') or 0) + (u.get('cache_read_input_tokens') or 0) + (u.get('cache_creation_input_tokens') or 0)
                if m['first_prompt_tokens'] is None and first:
                    m['first_prompt_tokens'] = first
            for b in msg.get('content') or []:
                if b.get('type') == 'tool_use':
                    m['tool_calls'][b['name']] += 1
                    pending[b['id']] = b['name']
        elif t == 'user':
            for b in (j.get('message') or {}).get('content') or []:
                if isinstance(b, dict) and b.get('type') == 'tool_result' and b.get('is_error'):
                    m['tool_errors'][pending.get(b.get('tool_use_id'), '?')] += 1
        elif t == 'result':
            u = j.get('usage') or {}
            m['input_tokens'] += u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0)
            m['output_tokens'] += u.get('output_tokens', 0)
            m['cache_read_tokens'] += u.get('cache_read_input_tokens', 0)
            if j.get('is_error') or j.get('subtype') != 'success':
                m['provider_errors'] += 1


def durable(path, m):
    for j in lines(path):
        if 'summary' in j:
            for u in (j['summary'].get('usage') or {}).get('models', {}).values():
                m['input_tokens'] += u.get('input', 0)
                m['output_tokens'] += u.get('output', 0)
                m['cache_read_tokens'] += u.get('cacheRead', 0)
            if j['summary'].get('status') != 'done':
                m['provider_errors'] += 1
            continue
        e = j.get('entry') or {}
        for msg in e.get('model') or []:
            if msg.get('role') == 'assistant':
                m['model_calls'] += 1
                u = msg.get('usage') or {}
                if m['first_prompt_tokens'] is None and u:
                    m['first_prompt_tokens'] = u.get('input', 0) + u.get('cacheRead', 0)
                if msg.get('stopReason') == 'error':
                    m['retries'] += 1  # Durable commits failed attempts to the transcript, then retries them
                for b in msg.get('content') or []:
                    if b.get('type') == 'toolCall':
                        m['tool_calls'][b['name']] += 1
            elif msg.get('role') == 'toolResult' and msg.get('isError'):
                m['tool_errors'][msg.get('toolName', '?')] += 1


def codex(path, m):
    """codex exec --json: item.* events, turn.completed carries usage for the whole turn."""
    for j in lines(path):
        t = j.get('type')
        if t == 'turn.completed':
            u = j.get('usage') or {}
            m['input_tokens'] += u.get('input_tokens', 0) - u.get('cached_input_tokens', 0)
            m['cache_read_tokens'] += u.get('cached_input_tokens', 0)
            m['output_tokens'] += u.get('output_tokens', 0)
        elif t == 'turn.failed':
            m['provider_errors'] += 1
        elif t == 'error':
            msg = str(j.get('message', ''))
            if 'retry' in msg.lower() or 'reconnect' in msg.lower():
                m['retries'] += 1
            else:
                m['provider_errors'] += 1
        elif t == 'item.completed':
            it = j.get('item') or {}
            k = it.get('type')
            if k in ('command_execution', 'file_change', 'mcp_tool_call', 'web_search'):
                name = {'command_execution': 'bash', 'file_change': 'apply_patch'}.get(k, k)
                m['tool_calls'][name] += 1
                if it.get('status') == 'failed' or (k == 'command_execution' and it.get('exit_code') not in (0, None)):
                    m['tool_errors'][name] += 1
            elif k == 'agent_message':
                m['model_calls'] += 1


rows = []
for R in sorted((Q / 'runs').glob('*-*-*')):
    if not (R / 'meta.json').exists():
        continue
    meta = json.loads((R / 'meta.json').read_text())
    try:
        chk = json.loads((R / 'check.json').read_text())
    except Exception:
        chk = {'passed': 0, 'total': 0, 'linesChanged': 0, 'changed': []}
    m = blank()
    for ph in meta['phases']:
        p = R / f"events-{ph['phase']}.jsonl"
        {'claude': claude, 'pi': pi_like, 'omp': pi_like, 'durable': durable, 'codex': codex}[meta['harness']](p, m)
    edit_calls = sum(v for k, v in m['tool_calls'].items() if k in EDIT_TOOLS)
    edit_errors = sum(v for k, v in m['tool_errors'].items() if k in EDIT_TOOLS)
    rows.append({
        'run': R.name, 'harness': meta['harness'], 'task': meta['task'], 'rep': meta['rep'],
        'passed': chk['passed'], 'total': chk['total'], 'full_pass': chk['passed'] == chk['total'] and chk['total'] > 0,
        'lines_changed': chk.get('linesChanged', 0), 'files_changed': len(chk.get('changed', [])),
        'seconds': round(sum(p['seconds'] for p in meta['phases']), 1),
        'model_calls': m['model_calls'], 'tool_calls': sum(m['tool_calls'].values()),
        'edit_calls': edit_calls, 'edit_errors': edit_errors, 'tool_errors': sum(m['tool_errors'].values()),
        'input_tokens': m['input_tokens'], 'cache_read_tokens': m['cache_read_tokens'], 'output_tokens': m['output_tokens'],
        'first_prompt_tokens': m['first_prompt_tokens'],
        'provider_errors': m['provider_errors'], 'retries': m['retries'],
        'nudge_needed': any(p.get('nudge_prompt') for p in meta['phases']),
        'killed_at': next((p.get('killed_at') for p in meta['phases'] if p.get('killed_at')), None),
        'tools': dict(m['tool_calls']), 'tool_error_detail': dict(m['tool_errors']),
    })

out = Q / 'results'
out.mkdir(exist_ok=True)
(out / 'runs.json').write_text(json.dumps(rows, ensure_ascii=False, indent=1))
cols = [k for k in rows[0] if k not in ('tools', 'tool_error_detail')] if rows else []
with open(out / 'runs.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
    w.writeheader()
    w.writerows(rows)
show = ['run', 'passed', 'total', 'seconds', 'model_calls', 'tool_calls', 'edit_calls', 'edit_errors', 'first_prompt_tokens', 'input_tokens', 'cache_read_tokens', 'output_tokens', 'provider_errors', 'retries']
print('\t'.join(show))
for r in rows:
    print('\t'.join(str(r[c]) for c in show))
