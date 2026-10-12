// 可选：使用指定宿主实际导出的 Cordis / scope 契约做纯内存验证。
// 不加载 profile、凭据或真实 provider；不启动服务，不写宿主目录。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as promptZh from '../lib/index.js';

const hostRoot = process.argv[2];
if (!hostRoot) throw new Error('用法：node tests/host-smoke.mjs <宿主 app 根目录>');
const requireHost = createRequire(resolve(hostRoot, 'package.json'));
const load = (name) => import(pathToFileURL(requireHost.resolve(name)).href);
const { Context, Service } = await load('@deepseek-ai/cordis');
const { createScope, scopeTarget } = await load('@deepseek-ai/dsh-scope');
const { createUserMessage } = await load('@deepseek-ai/dsh-llm');
const ctx = new Context();
const live = [];
class TestAgents extends Service {
  constructor(owner) { super(owner, 'agents'); }
  list() { return [...live]; }
}
const { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt');
const promptService = ctx.plugin(SystemPrompt, {});
await promptService;
const localization = ctx.plugin(promptZh);
await localization;
const a = {};
const aScope = createScope(ctx, a);
await aScope.ctx.fiber;
a.ctx = aScope.ctx;
const scopedPrompt = a.ctx.get('systemPrompt');
const hostPrompt = ctx.get('systemPrompt');
const delegationText = 'Start independent delegations with `subagent` or `subagent_fork` together in one assistant message and continue useful work while they run.';
scopedPrompt.section({
  name: 'tool:subagent', order: scopedPrompt.getSectionOrder('TOOL_SUBAGENT'), text: delegationText
});
scopedPrompt.tools(() => ({ schemas: ['subagent', 'subagent_fork'].map((name) => ({
  name, description: 'Schema descriptions intentionally stay English.', parameters: { type: 'object' }
})) }));
scopedPrompt.context({
  name: 'sandbox:policy', order: 0, required: true,
  text: () => 'Current DSH file policy: danger-full-access. The DSH file sandbox does not restrict file modifications by available operations.'
});
const assembly = await hostPrompt.assemble({ scope: a });
assert.ok(assembly.sections.some((section) => section.name === 'harness:identity' && section.text.includes('你是由')));
assert.ok(assembly.sections.some((section) => section.name === 'policy:delegation' && section.text.includes('subagent、subagent_fork')));
assert.ok(!assembly.sections.some((section) => section.text.includes('Start independent')));
assert.equal(assembly.tools[0].description, 'Schema descriptions intentionally stay English.');
assert.ok(assembly.contexts[0].text.startsWith('当前 DSH 文件策略'));
assert.ok(hostPrompt.refreshContext(assembly, { scope: a }).contexts[0].text.startsWith('Current DSH file policy'));
console.log('PASS host: 插件真实加载/assemble 委派规则/工具 schema 不变/refreshContext 边界');
const text = 'Time sampled while preparing turn 2, step 12: 2026-10-12T17:18:04+08:00[Asia/Hong_Kong]\nElapsed since the preceding step context: unavailable.';
const message = createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'time-context' } });
const disposePreset = a.ctx.on('agent/pre-step', async (_payload, next) => {
  const decision = await next();
  return decision.kind === 'reject' ? decision : { ...decision, messages: [...decision.messages, message] };
}, { prepend: true });
const step = (agent, messages = []) => ctx.waterfall(scopeTarget(agent, agent), 'agent/pre-step', {
  agent, turn: 2, step: 1, signal: new AbortController().signal
}, async () => ({ kind: 'enter', messages }));
assert.equal((await step(a)).messages[0], message);
console.log('PASS host: 真实 Cordis 复现 preset 晚注册的漏译');
live.push(a);
const registry = ctx.plugin((owner) => { new TestAgents(owner); });
await registry;
// 等待动态依赖的初始化，而不依赖 setTimeout 或私有 hook 列表。
await localization.ctx.inject(['agents'], () => {});
const translated = await step(a);
assert.match(translated.messages[0].content[0].text, /^准备第 2 轮、第 12 步/);
assert.equal(message.content[0].text, text);
assert.equal(translated.messages[0].source, message.source);
assert.equal(translated.messages[0].id, message.id);
console.log('PASS host: agents 动态就绪/已存在 agent 回补/冻结消息安全');
await ctx.serial(scopeTarget(a, a), 'agent/created', { agent: a });
const b = {};
const bScope = createScope(ctx, b);
await bScope.ctx.fiber;
b.ctx = bScope.ctx;
const ordinary = [{ role: 'user', content: '普通输入。' }];
assert.equal((await step(b, ordinary)).messages, ordinary);
console.log('PASS host: 真实 scopeTarget 路由与无匹配零分配');
b.ctx.on('agent/pre-step', async (_payload, next) => {
  const decision = await next();
  return { ...decision, messages: [...decision.messages, message] };
}, { prepend: true });
live.push(b);
await ctx.serial(scopeTarget(b, b), 'agent/created', { agent: b });
assert.match((await step(b)).messages[0].content[0].text, /^准备第 2 轮/);
console.log('PASS host: agent/created 在 preset 之后挂载');
await registry.dispose();
assert.equal((await step(a)).messages[0], message);
console.log('PASS host: agents 服务卸载自动清理作用域监听');
const restoredRegistry = ctx.plugin((owner) => { new TestAgents(owner); });
await restoredRegistry;
await localization.ctx.inject(['agents'], () => {});
assert.match((await step(a)).messages[0].content[0].text, /^准备第 2 轮/);
console.log('PASS host: agents 服务恢复重新回补');
// 再用宿主真正的 time-context 插件生成文本，而非只测试手写字面量。
class TestProjections extends Service {
  definitions = new Map();
  constructor(owner) { super(owner, 'sessionProjections'); }
  register(definition) {
    this.definitions.set(definition.key, definition);
    return this.ctx.effect(() => () => this.definitions.delete(definition.key));
  }
  stateOf(_session, key) { return this.definitions.get(key).init(); }
}
const projections = ctx.plugin((owner) => { new TestProjections(owner); });
await projections;
const c = { session: { seq: 0 } };
const cScope = createScope(ctx, c, { parent: a });
await cScope.ctx.fiber;
c.ctx = cScope.ctx;
const timeContext = await load('@deepseek-ai/dsh-time-context');
await c.ctx.plugin(timeContext, { timeZone: 'UTC', refreshIntervalMs: 0 });
live.push(c);
await ctx.serial(scopeTarget(c, c), 'agent/created', { agent: c });
for (const messages of [[], [createUserMessage({
  content: [{ type: 'text', text: '普通输入。' }],
  source: { kind: 'user', rpcId: 'isolated-test', clientTimeZone: 'UTC' }
})]]) {
  const actual = (await step(c, messages)).messages.at(-1);
  assert.equal(actual.source.kind, 'time-context');
  assert.match(actual.content[0].text, /^准备第 2 轮、第 1 步/);
  assert.ok(actual.content[0].text.includes(messages.length ? '浏览器时区：UTC' : '浏览器时区：不可用'));
  assert.ok(!actual.content[0].text.includes('Elapsed since'));
}
console.log('PASS host: 真实 time-context 插件/子作用域/时区已知与缺省');
await cScope.dispose();
await ctx.parallel(scopeTarget(c, c), 'agent/disposed', { agent: c });
await projections.dispose();
await localization.dispose();
assert.equal((await step(a)).messages[0], message);
console.log('PASS host: 插件卸载清理在 agent.ctx 注册的外部效果');
disposePreset();
await aScope.dispose();
await bScope.dispose();
await restoredRegistry.dispose();
await promptService.dispose();
console.log('host smoke: ALL PASS');
