import assert from 'node:assert/strict';
import { installMessageLocalization } from '../lib/lifecycle.js';

// 按已核验的 Cordis 契约复刻 prepend、作用域过滤、返回 disposer 和动态依赖卸载。
function harness() {
  const hooks = new Map();
  const injected = [];
  const live = [];
  function context(agent) {
    const owned = new Set();
    return {
      agents: { list: () => [...live] },
      on(event, listener, options = {}) {
        const entry = { agent, listener };
        const list = hooks.get(event) ?? [];
        hooks.set(event, list);
        list[options.prepend ? 'unshift' : 'push'](entry);
        const dispose = () => {
          const index = list.indexOf(entry);
          if (index >= 0) list.splice(index, 1);
          owned.delete(dispose);
        };
        owned.add(dispose);
        return dispose;
      },
      effect(setup) {
        const dispose = setup();
        owned.add(dispose);
        return dispose;
      },
      inject(names, callback) {
        assert.deepEqual(names, ['agents']);
        injected.push(() => {
          const scope = context();
          callback(scope);
          return scope;
        });
      },
      async dispose() {
        for (const dispose of [...owned]) await dispose();
        owned.clear();
      }
    };
  }
  const root = context();
  return {
    root, live,
    activate: () => injected[0](),
    agent() {
      const agent = {};
      agent.ctx = context(agent);
      return agent;
    },
    async emit(event, agent) {
      for (const entry of [...(hooks.get(event) ?? [])]) {
        if (!entry.agent || entry.agent === agent) await entry.listener({ agent });
      }
    },
    async step(agent, messages) {
      const entries = [...(hooks.get('agent/pre-step') ?? [])].filter((entry) => !entry.agent || entry.agent === agent);
      let index = 0;
      const payload = { agent };
      const next = () => index < entries.length
        ? entries[index++].listener(payload, next)
        : Promise.resolve({ kind: 'enter', messages });
      return next();
    },
    count: (agent) => (hooks.get('agent/pre-step') ?? []).filter((entry) => entry.agent === agent).length
  };
}

export async function lifecycleChecks() {
  const results = [];
  const check = (label, assertion) => {
    assertion();
    results.push({ label, ok: true, missing: [] });
  };
  const host = harness();
  const time = 'Time sampled while preparing turn 2, step 12: 2026-10-12T17:18:04+08:00[Asia/Hong_Kong]\nElapsed since the preceding step context: unavailable.';
  installMessageLocalization(host.root);
  const a = host.agent();
  const b = host.agent();
  const timeMessage = Object.freeze({
    id: 'time', role: 'user', source: Object.freeze({ kind: 'time-context' }),
    content: Object.freeze([Object.freeze({ type: 'text', text: time })])
  });
  // prompt-zh 先加载，preset 后注册 prepend：旧实现在这一真实顺序下漏译。
  a.ctx.on('agent/pre-step', async (_payload, next) => {
    const decision = await next();
    return decision.kind === 'reject' ? decision : { ...decision, messages: [...decision.messages, timeMessage] };
  }, { prepend: true });
  const before = await host.step(a, []);
  check('lifecycle: 复现 preset 晚注册导致全局监听漏译', () => assert.equal(before.messages[0], timeMessage));
  host.live.push(a);
  const dependency = host.activate();
  const after = await host.step(a, []);
  check('lifecycle: agents 延迟就绪/已存在 agent 回补', () => assert.match(after.messages[0].content[0].text, /^准备第 2 轮、第 12 步/));
  check('lifecycle: 冻结消息不被修改且保留身份和来源', () => {
    assert.equal(timeMessage.content[0].text, time);
    assert.equal(after.messages[0].id, timeMessage.id);
    assert.equal(after.messages[0].source, timeMessage.source);
  });
  await host.emit('agent/created', a);
  check('lifecycle: 重复 created 不重复注册', () => assert.equal(host.count(a), 2)); // preset + 本插件
  b.ctx.on('agent/pre-step', async (_payload, next) => {
    const decision = await next();
    return decision.kind === 'reject' ? decision : { ...decision, messages: [...decision.messages, timeMessage] };
  }, { prepend: true });
  await host.emit('agent/created', b);
  const bDecision = await host.step(b, []);
  check('lifecycle: 新建 agent 在 preset 初始化后接线', () => assert.match(bDecision.messages[0].content[0].text, /^准备第 2 轮/));
  const ordinary = Object.freeze([{ role: 'user', content: '普通输入保持不变。' }]);
  const c = host.agent();
  const untouched = await host.step(c, ordinary);
  check('lifecycle: agent 作用域隔离/无匹配零分配', () => assert.equal(untouched.messages, ordinary));
  const reject = Object.freeze({ kind: 'reject', reason: 'test' });
  a.ctx.on('agent/pre-step', async () => reject);
  const rejected = await host.step(a, []);
  check('lifecycle: 内层 reject 原样透传', () => assert.equal(rejected, reject));
  await host.emit('agent/disposed', b);
  check('lifecycle: agent 注销仅清理自己的翻译监听器', () => {
    assert.equal(host.count(b), 1);
    assert.equal(host.count(a), 3); // preset + 本插件 + reject
  });
  await dependency.dispose();
  check('lifecycle: 动态依赖卸载清理其他 agent 监听器', () => assert.equal(host.count(a), 2));
  const reloaded = host.activate();
  check('lifecycle: 动态依赖恢复重新回补且不积累监听器', () => assert.equal(host.count(a), 3));
  await reloaded.dispose();
  await host.root.dispose();
  check('lifecycle: 插件全局兜底可卸载', () => assert.equal(host.count(undefined), 0));
  await a.ctx.dispose();
  await b.ctx.dispose();
  return results;
}
