#!/usr/bin/env python3
"""Run one harness on one task and record everything.

  python3 tools/run.py <claude|pi|omp|durable> <A|B|C> <rep>

A, B: one run from a fresh copy of the baseline.
C:    Task B, killed (whole process group) shortly after the first file change, then resumed with
      each harness's own resume mechanism. Records whether a nudge prompt was needed.

Output: runs/<harness>-<task>-<rep>/{work/, events*.jsonl, stderr*.log, meta.json, check.json}
"""
import json, os, signal, subprocess, sys, time
from pathlib import Path

Q = Path(__file__).resolve().parent.parent
BIN = Q / 'tools/node_modules/.bin'
MODEL = os.environ.get('RUN_MODEL', 'glm-4.7-flash')
TIMEOUT = int(os.environ.get('RUN_TIMEOUT', '1200'))

harness, task, rep = sys.argv[1], sys.argv[2], sys.argv[3]
R = Q / 'runs' / f'{harness}-{task}-{rep}'
W = R / 'work'
subprocess.run([str(Q / 'tools/prepare.sh'), str(W)], check=True)

key = next(l.split('=', 1)[1].strip() for l in (Path.home() / 'Desktop/yuhui-station/.env.local').read_text().splitlines() if l.startswith('ZHIPU_API_KEY='))
env = {**os.environ, 'ZHIPU_API_KEY': key}
prompt = (Q / 'tasks' / f"{'B' if task == 'C' else task}.prompt.txt").read_text()
nudge = (Q / 'tasks/C.resume.txt').read_text().strip()


def command(phase):
    """argv + extra env for the start or resume phase."""
    if harness == 'claude':
        e = {
            'CLAUDE_CONFIG_DIR': str(R / 'claude-config'),
            'ANTHROPIC_BASE_URL': 'https://open.bigmodel.cn/api/anthropic',
            'ANTHROPIC_AUTH_TOKEN': key,
            'ANTHROPIC_API_KEY': '',
            'ANTHROPIC_MODEL': MODEL,
            'ANTHROPIC_DEFAULT_HAIKU_MODEL': MODEL,
            'ANTHROPIC_DEFAULT_SONNET_MODEL': MODEL,
            'ANTHROPIC_DEFAULT_OPUS_MODEL': MODEL,
            'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC': '1',
            'API_TIMEOUT_MS': '600000',
        }
        base = [str(BIN / 'claude'), '-p', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions', '--model', MODEL]
        return (base + [prompt] if phase == 'start' else base + ['--continue', nudge]), e, phase != 'start'
    if harness in ('pi', 'omp'):
        e = {'PI_CODING_AGENT_DIR': str(Q / 'config' / f'{harness}-agent')}
        base = [str(BIN / harness), '--model', f'zhipu/{MODEL}', '--mode', 'json', '--session-dir', str(R / 'sessions')]
        if phase == 'start':
            return base + [prompt], e, False
        # OMP's --restore (continue the interrupted turn, no new prompt) refuses to run without an
        # interactive terminal ("--restore requires an interactive terminal"), so headless runs use
        # --continue + the same nudge as Pi.
        return base + ['--continue', nudge], e, True
    if harness == 'codex':
        # Codex only speaks the Responses API, so it goes through the local LiteLLM bridge (config/litellm.yaml),
        # which forwards to the same Zhipu Anthropic-compatible endpoint. Start the bridge before running.
        home = R / 'codex-home'
        if not home.exists():
            home.mkdir(parents=True)
            (home / 'config.toml').write_text((Q / 'config/codex/config.toml').read_text().replace('glm-4.7-flash', MODEL))
        e = {'CODEX_HOME': str(home), 'LITELLM_MASTER_KEY': os.environ['LITELLM_MASTER_KEY']}
        base = [str(BIN / 'codex'), 'exec', '--skip-git-repo-check', '--json']
        if phase == 'start':
            return base + ['-C', str(W), prompt], e, False
        return [str(BIN / 'codex'), 'exec', 'resume', '--last', '--skip-git-repo-check', '--json', nudge], e, True
    if harness == 'durable':
        base = ['node', str(Q / 'tools/durable-run.mjs'), '--db', str(R / 'durable.sqlite'), '--cwd', str(W), '--model', MODEL]
        return (base + ['--prompt', prompt] if phase == 'start' else base + ['--resume']), {}, False
    raise SystemExit(f'unknown harness {harness}')


def changed_files():
    out = subprocess.run(['git', '-C', str(W), 'status', '--porcelain'], capture_output=True, text=True).stdout
    return [l[3:] for l in out.splitlines() if l.strip()]


def run_phase(phase, interrupt=False):
    argv, extra, nudged = command(phase)
    ev = open(R / f'events-{phase}.jsonl', 'w')
    er = open(R / f'stderr-{phase}.log', 'w')
    t0 = time.time()
    p = subprocess.Popen(argv, cwd=W, env={**env, **extra}, stdout=ev, stderr=er, stdin=subprocess.DEVNULL, start_new_session=True)
    killed_at, first_change = None, None
    while p.poll() is None:
        time.sleep(1)
        el = time.time() - t0
        if interrupt and first_change is None and changed_files():
            first_change = el
        if interrupt and first_change is not None and el - first_change >= 15:
            os.killpg(p.pid, signal.SIGKILL)
            killed_at = el
            p.wait()
            break
        if el > TIMEOUT:
            os.killpg(p.pid, signal.SIGKILL)
            p.wait()
            break
    ev.close(); er.close()
    return {'phase': phase, 'argv0': Path(argv[0]).name, 'nudge_prompt': nudged, 'exit': p.returncode, 'seconds': round(time.time() - t0, 1),
            'killed_at': killed_at, 'first_change_at': first_change, 'timed_out': time.time() - t0 > TIMEOUT,
            'changed_after': changed_files()}


meta = {'harness': harness, 'task': task, 'rep': rep, 'model': MODEL, 'started': time.strftime('%Y-%m-%d %H:%M:%S'), 'phases': []}
if task == 'C':
    meta['phases'].append(run_phase('start', interrupt=True))
    time.sleep(3)
    meta['phases'].append(run_phase('resume'))
else:
    meta['phases'].append(run_phase('start'))
(R / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
if task == 'P':  # overhead probe: trivial prompt, nothing to check
    (R / 'check.json').write_text('{"passed":0,"total":0,"linesChanged":0,"changed":[]}')
    print(f'{harness}-P-{rep}: probe done'); sys.exit(0)
check = subprocess.run(['node', str(Q / 'checks/check.mjs'), 'B' if task == 'C' else task, str(W)], capture_output=True, text=True)
(R / 'check.json').write_text(check.stdout or check.stderr)
try:
    c = json.loads(check.stdout)
    print(f"{harness}-{task}-{rep}: {c['passed']}/{c['total']} checks, {c['linesChanged']} lines, " + ', '.join(f"{p['phase']} {p['seconds']}s" for p in meta['phases']))
except Exception:
    print(f'{harness}-{task}-{rep}: check failed to run', check.stderr[:300])
