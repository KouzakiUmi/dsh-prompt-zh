// 保留全局兜底；agent preset 在运行时挂载，不能仅按 bundle 顺序判断瀑布层级。
// agent/created 在 factory setup 完成后触发，此时为该 agent 注册最外层 prepend。
import { translateMessages } from './injections.js';

async function localizeDecision(_payload, next) {
  const decision = await next();
  if (decision.kind === 'reject' || !Array.isArray(decision.messages)) return decision;
  const messages = translateMessages(decision.messages);
  return messages === decision.messages ? decision : { ...decision, messages };
}

export function installMessageLocalization(ctx) {
  ctx.on('agent/pre-step', localizeDecision, { prepend: true });

  // 动态依赖：agents 未就绪时不阻止静态翻译，服务卸载时释放本层全部监听器。
  ctx.inject(['agents'], (scope) => {
    const disposers = new Map();
    const install = (agent) => {
      if (disposers.has(agent)) return;
      // 自定义 registry agent 不一定有 Cordis ctx，仍由全局监听器兜底。
      if (typeof agent.ctx?.on !== 'function') return;
      const dispose = agent.ctx.on('agent/pre-step', (payload, next) =>
        payload.agent === agent ? localizeDecision(payload, next) : next(), { prepend: true });
      disposers.set(agent, dispose);
    };
    scope.on('agent/created', ({ agent }) => { install(agent); });
    scope.on('agent/disposed', ({ agent }) => {
      const dispose = disposers.get(agent);
      if (!dispose) return;
      disposers.delete(agent);
      dispose();
    });
    // 当前 Cordis 用 effect 返回的 disposer 执行卸载，不派发普通 dispose 事件。
    scope.effect(() => () => {
      for (const dispose of disposers.values()) dispose();
      disposers.clear();
    }, 'prompt-zh: scoped listeners');
    // 包括热加载之前已经存在的 agent；重复 created 通知不重复注册。
    for (const agent of scope.agents.list()) install(agent);
  });
}
