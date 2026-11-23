#!/usr/bin/env python3
"""Evidence screenshots: run real commands over the recorded runs and render command + output as terminal-style HTML.

  python3 tools/evidence.py          → evidence-html/*.html   (then: node tools/shoot.mjs → answers/media/q1/*.png)

Nothing here is typed by hand: every block below is a shell command, and the image shows exactly what it printed.
Home-directory paths are shortened to ~ in the output.
"""
import html, os, subprocess
from pathlib import Path

Q = Path(__file__).resolve().parent.parent
OUT = Q / 'evidence-html'
OUT.mkdir(parents=True, exist_ok=True)
HOME = str(Path.home())

SHOTS = [
    ('01-results', '全部有效运行的汇总（tools/analyze.py，从事件流统计）', [
        "python3 tools/analyze.py | awk -F'\\t' '$1 !~ /-P-/ {printf \"%-12s %2s/%-2s %7s %5s %5s %5s %5s %5s %5s\\n\", $1,$2,$3,$4,$5,$6,$7,$8,$13,$14}' | sed '1s/.*/run          pass    secs calls tools edits e_err p_err retry/'",
    ]),
    ('02-hidden-check', '隐藏验收测试：真的运行改完的代码（claude-B-1 的 check.json）', [
        "python3 -c \"import json; c=json.load(open('runs/claude-B-1/check.json')); print('passed', c['passed'], '/', c['total'], ' lines changed', c['linesChanged']); [print(('PASS ' if i['pass'] else 'FAIL ') + i['name']) for i in c['items']]\"",
        "python3 -c \"import json; c=json.load(open('runs/claude-B-1/check.json')); print([i['detail'] for i in c['items'] if i['name']=='server: keeps first 3 items per resident'][0])\"",
    ]),
    ('03-probe', '空任务（只回复\"好的\"）时，每个 harness 第一次请求带了多少 token', [
        "python3 -c \"import json; [print(f\\\"{r['harness']:8} input={r['input_tokens']:>6}  cache_read={r['cache_read_tokens']:>5}  total={r['input_tokens']+r['cache_read_tokens']:>6}\\\") for r in json.load(open('results/runs.json')) if r['task']=='P']\"",
    ]),
    ('04-omp-hashline', 'OMP 的 hashline 编辑：GLM 写错格式时的报错原文（omp-B-1）', [
        "python3 -c \"import json\nfor l in open('runs/omp-B-1/events-start.jsonl'):\n  j=json.loads(l); m=j.get('message') or {}\n  if j.get('type')=='message_end' and m.get('role')=='toolResult' and m.get('isError') and m.get('toolName')=='edit': print('edit ✗', m['content'][0]['text'].splitlines()[0][:150])\"",
    ]),
    ('05-codex-claims-done', 'Codex 说\"类型检查通过\"，隐藏测试发现服务端编译不过（codex-A-1）', [
        "grep -o 'tsc --noEmit[^\"]\\{0,30\\}' runs/codex-A-1/events-start.jsonl | tail -2",
        "git -C runs/codex-A-1/work diff -U0 server/aiProxy.ts | grep '^[-+] '| cut -c1-150",
        "python3 -c \"import json; c=json.load(open('runs/codex-A-1/check.json')); [print('FAIL', i['name'], '→', i['detail'].strip()[:120]) for i in c['items'] if not i['pass']]\"",
    ]),
    ('06-codex-fallback', 'Codex 遇到非 OpenAI 模型：使用默认配置，只剩 shell 一个工具', [
        "grep -o '\"message\":\"Model metadata[^\"]*\"' runs/codex-A-1/events-start.jsonl",
        "python3 -c \"import json; [print(r['run'], r['tools']) for r in json.load(open('results/runs.json')) if r['harness']=='codex' and r['task']!='P']\"",
        "python3 -c \"import json\nfor l in open('runs/codex-A-1/events-start.jsonl'):\n  it=json.loads(l).get('item') or {}\n  c=it.get('command','')\n  if it.get('status')=='completed' and 'sed -i' in c: print('$', c.split('&& ',1)[-1][:110])\"",
    ]),
    ('07-retry', '服务端过载时：Claude Code 退避重试，Codex 与 Pi Durable 很快放弃', [
        "grep -h api_retry runs/claude-C-1/events-*.jsonl | python3 -c \"import sys,json; rs=[json.loads(l) for l in sys.stdin]; print('claude-C-1:', len(rs), 'retries'); [print('  attempt', r['attempt'], '/', r['max_retries'], ' status', r['error_status'], ' wait', r['retry_delay_ms'], 'ms') for r in rs[:5]]\"",
        "grep -o '\"message\":\"Selected model is at capacity[^\"]*\"' runs/_infra/codex-A-3.round2/events-start.jsonl | head -1; python3 -c \"import json; p=json.load(open('runs/_infra/codex-A-3.round2/meta.json'))['phases'][0]; print('codex-A-3 (round 2): exit', p['exit'], 'after', p['seconds'], 's, changed', p['changed_after'])\"",
        "grep -o '\"errorMessage\":\"5[0-9][0-9]' runs/_infra/durable-A-2/events-start.jsonl | sort | uniq -c; tail -1 runs/_infra/durable-A-2/events-start.jsonl | python3 -c \"import sys,json; s=json.load(sys.stdin)['summary']; print('durable-A-2:', s['status'], s['reason'], 'after', s['ms'], 'ms')\"",
    ]),
    ('08-wait-for-model', '为了拿到 Codex 的数据：每 10 分钟测一次 glm-4.7-flash，3 次全成功才开跑', [
        "cat notes/codex-wait-log.txt",
    ]),
    ('09-resume', '任务 C：被 SIGKILL 之后，各家怎么接着做', [
        "for r in claude-C-1 durable-C-1 codex-C-1; do python3 -c \"import json; m=json.load(open('runs/$r/meta.json'))\nfor p in m['phases']: print(f\\\"{'$r':12} {p['phase']:6} exit={str(p['exit']):3} {p['seconds']:6}s  killed_at={p['killed_at'] and round(p['killed_at'])}  nudge={p['nudge_prompt']}  changed={len(p['changed_after'])} files\\\")\"; done",
        "python3 -c \"import json\nfor ph in ['start','resume']:\n  for l in open(f'runs/claude-C-1/events-{ph}.jsonl'):\n    j=json.loads(l)\n    if j.get('type')=='assistant':\n      for b in j['message'].get('content',[]):\n        if b.get('type')=='tool_use' and b['name']=='Edit': print('claude', ph, 'Edit', b['input']['file_path'].split('work/')[-1])\"",
        "python3 -c \"import json; print('omp --restore:', open('runs/_infra/omp-C-1/stderr-resume.log').read().strip().splitlines()[0])\"",
    ]),
]

CSS = """body{margin:0;background:#1e1f22;font:15px/1.45 'SF Mono',Menlo,'PingFang SC',monospace;color:#d4d4d4}
.win{margin:0;padding:18px 22px 22px}.title{font:600 17px 'PingFang SC',-apple-system,sans-serif;color:#fff;margin-bottom:12px}
.dots{display:flex;gap:7px;margin-bottom:12px}.dots i{width:12px;height:12px;border-radius:50%;display:block}
.cmd{color:#7ee787;white-space:pre-wrap;word-break:break-all;margin:10px 0 4px}.cmd b{color:#8b949e;font-weight:400}
pre{margin:0;white-space:pre-wrap;word-break:break-all;color:#e6e6e6}.err{color:#ff7b72}.ok{color:#7ee787}
.foot{margin-top:14px;font:12px -apple-system,sans-serif;color:#8b949e}"""


def color(line):
    e = html.escape(line)
    if any(k in line for k in ('FAIL', '✗', 'error', 'capacity', 'unanswered', '529', 'requires an interactive')):
        return f'<span class="err">{e}</span>'
    if line.startswith('PASS') or 'probe' in line and '3/3' in line:
        return f'<span class="ok">{e}</span>'
    return e


for name, title, cmds in SHOTS:
    parts = []
    for c in cmds:
        r = subprocess.run(['bash', '-c', c], cwd=Q, capture_output=True, text=True)
        out = (r.stdout + r.stderr).replace(HOME, '~').rstrip()
        shown = c.replace(HOME, '~')
        if len(shown) > 260:
            shown = shown[:257] + '…'
        parts.append(f'<div class="cmd"><b>q1-harness-comparison $</b> {html.escape(shown)}</div><pre>' + '\n'.join(color(l) for l in out.splitlines()) + '</pre>')
    (OUT / f'{name}.html').write_text(f"""<!doctype html><meta charset="utf-8"><style>{CSS}</style><div class="win">
<div class="dots"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
<div class="title">{html.escape(title)}</div>{''.join(parts)}
<div class="foot">由 tools/evidence.py 运行上面的命令自动生成 · 模型 glm-4.7-flash · 2026-11-21/22</div></div>""")
    print(name)
