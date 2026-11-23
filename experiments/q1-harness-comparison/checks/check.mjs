// Hidden acceptance checks. The agents never see this file.
// Usage: node checks/check.mjs <A|B> <workdir>   → prints one JSON object
// Functional checks bundle the agent's code with esbuild, fake the model endpoint, and inspect what would be sent.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';

const [task, dirArg] = process.argv.slice(2);
const dir = resolve(dirArg);
const require = createRequire(join(dir, 'package.json'));
const esbuild = require('esbuild');
const items = [];
const check = (name, pass, detail = '') => items.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) });

// ---------------------------------------------------------------- static
const tsc = join(dir, 'node_modules/.bin/tsc');
const src = spawnSync(tsc, ['--noEmit', '-p', '.'], { cwd: dir, encoding: 'utf8' });
check('tsc src', src.status === 0, src.stdout + src.stderr);
const srv = spawnSync(tsc, ['--noEmit', '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', '--strict', '--skipLibCheck', '--types', 'node', 'server/aiProxy.ts'], { cwd: dir, encoding: 'utf8' });
check('tsc server', srv.status === 0, srv.stdout + srv.stderr);

const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
const changed = [...git('diff', '--name-only', 'HEAD').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean);
const numstat = git('diff', '--numstat', 'HEAD').trim().split('\n').filter(Boolean).map((l) => l.split('\t'));
const linesChanged = numstat.reduce((s, [a, d]) => s + (Number(a) || 0) + (Number(d) || 0), 0);
const allowed = task === 'A' ? ['src/ai/shared.ts', 'src/game/game.ts', 'server/aiProxy.ts'] : ['src/ai/shared.ts', 'src/game/game.ts', 'server/aiProxy.ts', 'src/state/save.ts'];
const stray = changed.filter((f) => !allowed.includes(f));
check('only expected files changed', stray.length === 0, stray.join(', '));

const fs = await import('node:fs');
const file = (f) => fs.readFileSync(join(dir, f), 'utf8');
const letterLine = file('src/game/game.ts').split('\n').find((l) => l.includes("task: 'letter'")) ?? '';

// ---------------------------------------------------------------- bundling helpers
const out = join(dir, '.check');
mkdirSync(out, { recursive: true });
async function load(entry, name) {
  const outfile = join(out, `${name}-${Date.now()}.mjs`);
  await esbuild.build({ entryPoints: [join(dir, entry)], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile, logLevel: 'silent' });
  return import(outfile);
}

const LETTER = { item: '一盒没寄出的明信片', to: 'tang', offer: ['这是一盒明信片', '交给老唐吧'], thanks: ['收到了', '谢谢你'], reply: '明信片我收好了，风会替你寄出去的。——老唐' };

async function proxy() {
  const mod = await load('server/aiProxy.ts', 'proxy');
  let handler;
  mod.aiProxy({ ZHIPU_API_KEY: 'test', AI_PROVIDER: 'zhipu', ZHIPU_MODEL: 'mock' }).configureServer({ config: { logger: { info() {} } }, middlewares: { use(_p, h) { handler = h; } } });
  const sent = [];
  globalThis.fetch = async (_url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(LETTER) }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 });
  };
  return async (body) => {
    sent.length = 0;
    const req = Readable.from([JSON.stringify(body)]);
    req.method = 'POST';
    let raw = '';
    const res = { statusCode: 200, setHeader() {}, end(s) { raw = s; } };
    await handler(req, res);
    const msg = sent[0]?.messages ?? [];
    return { status: res.statusCode, body: raw ? JSON.parse(raw) : null, system: msg[0]?.content ?? '', user: msg[1]?.content ?? '' };
  };
}

// ---------------------------------------------------------------- task A
if (task === 'A') {
  try {
    const shared = await load('src/ai/shared.ts', 'shared');
    check('AVOID_RECENT exported and equals 1', shared.AVOID_RECENT === 1, shared.AVOID_RECENT);
  } catch (e) {
    check('AVOID_RECENT exported and equals 1', false, e);
  }
  check('game.ts letter request uses AVOID_RECENT', letterLine.includes('AVOID_RECENT') && !/slice\(0,\s*2\)/.test(letterLine), letterLine.trim());
  try {
    const call = await proxy();
    const r = await call({ task: 'letter', text: '好久没给家里打电话了', avoid: ['chen', 'gan', 'wu'] });
    check('server keeps only 1 avoided resident', r.user.includes('小陈') && !r.user.includes('阿甘') && !r.user.includes('吴阿姨'), r.user);
    check('letter still generated', r.body?.source === 'ai', JSON.stringify(r.body));
  } catch (e) {
    check('server functional test runs', false, e?.stack ?? e);
  }
}

// ---------------------------------------------------------------- task B
if (task === 'B') {
  try {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    globalThis.location = { search: '' };
    const { Store } = await load('src/state/save.ts', 'save');
    const s = new Store();
    const q = (i, to) => ({ id: `m${i}`, ask: 'x', item: `物件${i}`, to, offer: ['a', 'b'], thanks: ['c', 'd'], reply: 'r', source: 'ai' });
    for (let i = 1; i <= 4; i++) {
      s.startMail(q(i, 'tang'));
      s.finishMail();
    }
    s.startMail(q(5, 'chen'));
    s.finishMail();
    const m = s.data.mail.memory ?? {};
    check('save: memory keeps newest 3 per resident', JSON.stringify(m.tang) === JSON.stringify(['物件4', '物件3', '物件2']), JSON.stringify(m));
    check('save: memory is per resident', JSON.stringify(m.chen) === JSON.stringify(['物件5']), JSON.stringify(m));
    check('save: quest still cleared', s.data.mail.quest === null && s.data.quests.active === null);
  } catch (e) {
    check('save functional test runs', false, e?.stack ?? e);
  }
  check('shared: AiRequest has memory field', /memory\?\s*:\s*Record<string,\s*string\[\]>/.test(file('src/ai/shared.ts')));
  check('game.ts letter request sends memory', letterLine.includes('memory'), letterLine.trim());
  try {
    const call = await proxy();
    const long = '这是一个超过十六个字的非常非常长的物件名字啊';
    const r = await call({ task: 'letter', text: '好久没给家里打电话了', memory: { tang: ['A', 'B', 'C', 'D'], hacker: ['X'], chen: [long, 'ok', 5] } });
    check('server: memory line present', r.user.includes('居民记得这位玩家以前送来的东西：'), r.user);
    check('server: keeps first 3 items per resident', r.user.includes('老唐：A、B、C') && !r.user.includes('D'), r.user);
    check('server: drops unknown residents', !r.user.includes('X') && !r.user.includes('hacker'), r.user);
    check('server: drops long and non-string items', r.user.includes('小陈：ok') && !r.user.includes(long), r.user);
    check('server: residents separated by ；', /老唐：A、B、C；小陈：ok|小陈：ok；老唐：A、B、C/.test(r.user), r.user);
    check('prompt: rule about mentioning memory', /记得.{0,30}(送来|送过|东西)/.test(r.system) && /列清单/.test(r.system), '');
    const none = await call({ task: 'letter', text: '好久没给家里打电话了' });
    check('server: no memory → no memory line', !none.user.includes('居民记得'), none.user);
    const avoid = await call({ task: 'letter', text: '好久没给家里打电话了', avoid: ['chen'] });
    check('regression: avoid still works', avoid.user.includes('小陈'), avoid.user);
    check('letter still generated', r.body?.source === 'ai', JSON.stringify(r.body));
  } catch (e) {
    check('server functional test runs', false, e?.stack ?? e);
  }
}

fs.rmSync(out, { recursive: true, force: true });
const passed = items.filter((i) => i.pass).length;
console.log(JSON.stringify({ task, passed, total: items.length, linesChanged, changed, items }, null, 1));
