// Minimal coding agent on Pi Durable, so it can be compared with the CLI harnesses.
// Pi Durable is a runtime library, not a CLI: model, tools and instructions below are this runner's choices.
//
//   node durable-run.mjs --db run.sqlite --cwd ./work --prompt "..."   start a run
//   node durable-run.mjs --db run.sqlite --cwd ./work --resume         continue whatever the last process left unfinished
//
// Needs ZHIPU_API_KEY. Writes one JSON line per transcript entry to stdout, and a summary at the end.
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createModels, createProvider, envApiKeyAuth } from '@earendil-works/pi-ai';
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { Harness, createRegistry } from '@earendil-works/pi-durable';
import { createCodingTools } from '@earendil-works/pi-durable/tools';
import { NodeExecutionEnv } from '@earendil-works/pi-durable/env/node';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';

const { values: args } = parseArgs({
  options: {
    db: { type: 'string' },
    cwd: { type: 'string' },
    prompt: { type: 'string' },
    resume: { type: 'boolean', default: false },
    model: { type: 'string', default: 'glm-4.7-flash' },
    'max-turns': { type: 'string', default: '60' },
  },
});
if (!args.db || !args.cwd || (!args.prompt && !args.resume)) {
  console.error('usage: --db <file> --cwd <dir> (--prompt <text> | --resume)');
  process.exit(2);
}
const cwd = resolve(args.cwd);
const ctx = BACKGROUND_CONTEXT;

const zhipu = createProvider({
  id: 'zhipu',
  name: 'Zhipu (Anthropic-compatible)',
  baseUrl: 'https://open.bigmodel.cn/api/anthropic',
  auth: { apiKey: envApiKeyAuth('Zhipu API key', ['ZHIPU_API_KEY']) },
  models: [
    {
      id: args.model,
      name: args.model,
      api: 'anthropic-messages',
      provider: 'zhipu',
      baseUrl: 'https://open.bigmodel.cn/api/anthropic',
      reasoning: false,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 32000,
    },
  ],
  api: anthropicMessagesApi(),
});
const models = createModels();
models.setProvider(zhipu);

const registry = createRegistry();
const coding = createCodingTools();
registry.install(coding);

const INSTRUCTIONS = `You are a coding agent working in the repository at ${cwd}.
Use the read, write, edit and bash tools to inspect and change files. Read files before editing them.
Make the smallest change that fully completes the task, run the checks the task asks for, and finish with a short summary of what you changed.`;

const harness = await Harness.open(
  await openNodeSqliteStorage(resolve(args.db)),
  { models, registry, env: ({ cwd: c }) => new NodeExecutionEnv({ cwd: c ?? cwd }) },
  ctx,
);
const root = await harness.root(ctx, {
  agent: {
    model: { provider: 'zhipu', modelId: args.model },
    extensions: [coding],
    instructions: INSTRUCTIONS,
    cwd,
    maxTurns: Number(args['max-turns']),
  },
});

// Stream transcript entries as JSON lines.
const seen = new Set();
const watch = await root.watch(ctx, { min: 200, max: 400 });
const emit = (entries) => {
  for (const e of entries ?? []) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    console.log(JSON.stringify({ t: Date.now(), entry: e }));
  }
};
emit(watch.value.entries);
watch.start(async (call) => {
  if (call.kind === 'value') emit(call.value.entries);
});

const t0 = Date.now();
let settled;
if (args.prompt) {
  const submission = await root.submit({ type: 'input', content: args.prompt, requestId: 'task-1' }, ctx);
  settled = await submission.wait(ctx);
} else {
  harness.resume();
  // The interrupted submission keeps its request ID, so it can be found and awaited again.
  const again = await root.submit({ type: 'input', content: '(resume marker, ignored if task-1 exists)', requestId: 'task-1' }, ctx);
  settled = await again.wait(ctx);
}
await new Promise((r) => setTimeout(r, 300));
await watch.stop();
const usage = await harness.usage(ctx);
console.log(JSON.stringify({ summary: { status: settled.status, reason: settled.reason ?? null, ms: Date.now() - t0, usage } }));
await harness.close(ctx);
