// 设置功能的隔离回归：不访问 Profile，不写生产配置，不调用模型或服务器。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { apply, getRules, translate, translateContext, translateMessages, translateGitBashText, translateMcp, translateAllMcp } from '../lib/index.js';
import { TranslationRuntime, COMPONENTS, normalizePreferences } from '../lib/rules.js';
import { createConfigSchema, versionResolver, installSettingsHost } from '../lib/settings-host.js';
import { gitbashSamples } from './new-guidance.mjs';

export function loadClient(React = {}, environment = {}) {
  let plugin;
  const context = vm.createContext({
    window: { __ModuleLoader__: { load: (descriptor) => { plugin = descriptor.factory((name) => { assert.equal(name, 'react'); return React; }); } } },
    Object, Map, Set, Array, JSON, Promise, String, AbortController, console, ...environment
  });
  vm.runInContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), context);
  return plugin;
}

export async function settingsChecks() {
  const checks = [];
  const check = (label, fn) => { fn(); checks.push({ label, ok: true, missing: [] }); };
  const rows = getRules();
  check('settings: 全部默认条目冷启动可枚举、稳定唯一', () => {
    assert.ok(rows.length >= 220);
    assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
    for (const component of COMPONENTS) assert.ok(rows.some((row) => row.component === component.id), component.id);
    assert.ok(rows.every((row) => typeof row.defaultText === 'string' && row.defaultText.length > 0));
  });
  check('settings: Core 兼容清单与各核心译文版本元数据保持一致', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const compatible = Object.entries(manifest.dsh.compatibility.dshReleases).filter(([, state]) => state === 'compatible').map(([version]) => version).sort();
    assert.deepEqual(manifest.engines.dsh.split(' || ').sort(), compatible, 'DSH STORE 范围与精确验收声明必须一致');
    assert.equal(manifest.dsh.compatibility.dsh, manifest.engines.dsh);
    for (const component of COMPONENTS.filter((item) => !item.thirdParty)) {
      assert.deepEqual([...component.versions].sort(), compatible, component.id);
      for (const row of rows.filter((item) => item.component === component.id)) assert.deepEqual([...row.versions].sort(), compatible, row.id);
    }
  });
  const identity = rows.find((row) => row.id === 'core:harness:identity');
  const timestamp = rows.find((row) => row.component === 'time' && row.defaultText.startsWith('准备第 $1'));
  const bash = rows.find((row) => row.component === 'gitbash' && row.defaultText.startsWith('当前工作 shell') && row.defaultText.includes('/tmp'));
  let preferences = { disabledComponents: [], overrides: { [identity.id]: '这是实际替换用的自定义身份译文。', [timestamp.id]: '第 $1 轮/$2 步：$3', [bash.id]: '使用 Git Bash，路径规则按已核验说明执行。' } };
  let versions = { gitbash: { version: '0.39.4' }, hindsight: { version: '0.8.1' } };
  const runtime = new TranslationRuntime({ preferences: { get: () => preferences } }, () => versions);
  check('settings: 保存覆盖值进入实际 section／消息／工具附加翻译', () => {
    const operation = runtime.operation('test');
    assert.equal(translate('harness:identity', 'You are an AI agent powered by DeepSeek Harness.', operation), preferences.overrides[identity.id]);
    const messages = translateMessages([{ content: 'Time sampled while preparing turn 2, step 3: PRIVATE_TIMESTAMP' }], operation);
    assert.equal(messages[0].content, '第 2 轮/3 步：PRIVATE_TIMESTAMP');
    assert.equal(translateGitBashText(gitbashSamples[0].text, operation), preferences.overrides[bash.id]);
    const diagnostic = runtime.describe();
    assert.ok(diagnostic.entries.find((row) => row.id === identity.id).metrics.replaced > 0);
    assert.ok(!JSON.stringify(diagnostic).includes('PRIVATE_TIMESTAMP'));
  });
  check('settings: 严格精确版本；MCP 已知 server 按原文守卫放行、未知 server 不放行', () => {
    versions = { gitbash: { version: '0.39.5' } };
    assert.equal(translateGitBashText(gitbashSamples[0].text, runtime.operation('test')), gitbashSamples[0].text);
    assert.equal(runtime.describe().components.find((component) => component.id === 'gitbash').versionStatus, 'mismatch');
    // 服务器版本仍不可核验（不借 MCP 客户端版本），但已知 server 的守卫式译文照常执行。
    assert.equal(runtime.describe().components.find((component) => component.id === 'mcp.blender').versionStatus, 'unavailable');
    assert.ok(runtime.describe().entries.find((row) => row.component === 'mcp.blender').active);
    assert.ok(!runtime.describe().entries.find((row) => row.component === 'mcp.other').active);
    const operation = runtime.operation('test');
    const blenderBlock = '### MCP server: blender\n\nThe `execute_blender_code` tool is a last resort, if there are other tools that provide the functionality you need, use those instead.';
    assert.ok(translateMcp('mcp:blender', blenderBlock, operation).includes('仅作为最后手段'));
    // 未知 server 的标题与正文保持原文，不猜译。
    const unknown = '### MCP server: unknown-server\n\nDo something custom.';
    assert.equal(translateMcp('mcp:unknown-server', unknown, operation), unknown);
  });
  check('mcp: 全文与注入回放均不跨服务器边界，关闭组件仍保留原文', () => {
    const sentence = 'The GitHub MCP Server provides tools to interact with GitHub platform.';
    const body = `Tool selection guidance:\n\n${sentence}`;
    const unknown = `### MCP server: unknown-server\n\n${body}`;
    const known = `### MCP server: github\n\n${body}`;
    const otherKnown = `### MCP server: context7\n\n${body}`;
    const combined = `${unknown}\n\n${known}\n\n${otherKnown}`;
    const operation = new TranslationRuntime().operation('test');
    assert.equal(translateAllMcp(unknown, operation), unknown);
    assert.equal(translateMcp('mcp:github', unknown, operation), unknown);
    const output = translateAllMcp(combined, operation);
    assert.ok(output.startsWith(unknown));
    assert.ok(output.includes('GitHub MCP 服务器提供与 GitHub 平台交互的工具'));
    assert.ok(output.endsWith(`### MCP 服务器：context7\n\n${body}`));
    assert.equal(translateAllMcp(output, operation), output);
    assert.equal(translateMessages([{ content: combined }], operation)[0].content, output);
    const disabled = new TranslationRuntime({ preferences: { disabledComponents: ['mcp.github'] } }).operation('test');
    assert.equal(translateAllMcp(known, disabled), known);
    assert.equal(translateAllMcp(combined.replaceAll('\n', '\r\n'), operation).replaceAll('\r\n', '\n'), output);
  });
  check('blender: 已中文化标题重入不虚增输出改变计数', () => {
    const observed = new TranslationRuntime();
    const original = '### MCP server: blender\n\nYou have access to Blender tools to interact with a Blender scene directly.';
    const localized = translateMcp('mcp:blender', original, observed.operation('assemble'));
    const before = observed.describe().entries.find((row) => row.component === 'mcp.blender' && row.source === '### MCP server: blender').metrics.replaced;
    assert.equal(before, 1);
    assert.equal(translateAllMcp(localized, observed.operation('pre-step')), localized);
    const after = observed.describe().entries.find((row) => row.component === 'mcp.blender' && row.source === '### MCP server: blender').metrics;
    assert.equal(after.replaced, before);
    assert.equal(after.stages['pre-step'].replaced, 0);
  });
  check('settings: 组件关闭原文透传、再次开启读取新值', () => {
    preferences = { disabledComponents: ['core', 'time'], overrides: { [identity.id]: '新的实际译文。' } };
    const operation = runtime.operation('test');
    assert.equal(translate('harness:identity', 'You are an AI agent powered by DeepSeek Harness.', operation), 'You are an AI agent powered by DeepSeek Harness.');
    assert.equal(translateMessages([{ content: 'Time sampled while preparing turn 1, step 2: TEST' }], operation)[0].content, 'Time sampled while preparing turn 1, step 2: TEST');
    preferences = { disabledComponents: [], overrides: { [identity.id]: '新的实际译文。' } };
    assert.equal(translate('harness:identity', 'You are an AI agent powered by DeepSeek Harness.', runtime.operation('test')), '新的实际译文。');
  });
  check('settings: 不新增匹配规则、捕获值不可删除／伪装成字面量', () => {
    assert.throws(() => normalizePreferences({ overrides: { unknown: '文本' } }));
    assert.throws(() => normalizePreferences({ overrides: { [timestamp.id]: '删除了捕获值' } }));
    assert.throws(() => normalizePreferences({ overrides: { [timestamp.id]: '$$1/$2/$3' } }));
    assert.throws(() => normalizePreferences({ overrides: { [identity.id]: '未知 $1' } }));
    assert.equal(normalizePreferences({ overrides: { [identity.id]: identity.defaultText } }).overrides[identity.id], undefined);
  });
  check('settings: 刷新覆盖风险不冒充最终生效', () => {
    const entry = rows.find((row) => row.id === 'context:sandbox:danger-full-access');
    assert.ok(entry.coverage.includes('refresh'));
    preferences = { overrides: { [entry.id]: '自定义文件策略译文。' } };
    assert.equal(translateContext('sandbox:policy', 'Current DSH file policy: danger-full-access.', runtime.operation('assemble')), '自定义文件策略译文。');
    assert.ok(!JSON.stringify(runtime.describe()).includes('finalRequestEffective'));
  });
  check('settings: 版本解析拒绝不变成“未安装”，只读公开来源', () => {
    const fake = { get: (name) => name === 'profileContext' ? { resolvePackageManifest: (name) => name } : undefined };
    const resolve = versionResolver(fake, (name) => { if (name === 'dsh-gitbash-shell') return { name, version: '0.39.4' }; throw new Error('EACCES PRIVATE_PATH'); });
    const result = resolve();
    assert.equal(result.gitbash.version, '0.39.4');
    assert.equal(result.hindsight.status, 'unavailable');
    assert.ok(!JSON.stringify(result).includes('PRIVATE_PATH'));
  });
  check('settings: rc.2 无 Profile manifest 方法时回退 pluginPackages 精确解析', () => {
    const lookedUp = [];
    const fake = { get: (name) => name === 'profileContext' ? {} : name === 'pluginPackages' ? {
      packageOf: (name, from) => { lookedUp.push(name); assert.ok(from.endsWith('/lib/settings-host.js')); return { manifestPath: name }; }
    } : undefined };
    const resolved = versionResolver(fake, (name) => ({ name, version: name === 'dsh-gitbash-shell' ? '0.42.2' : name === '@vectorize-io/hindsight-coding-agents' ? '0.8.2' : '0.2.1-rc.2' }))();
    assert.equal(resolved.gitbash.version, '0.42.2');
    assert.equal(resolved.hindsight.version, '0.8.2');
    assert.equal(resolved.core.version, '0.2.1-rc.2');
    assert.equal(lookedUp.filter((name) => name === '@deepseek-ai/dsh-system-prompt').length, 1);
  });
  const routes = [], callbacks = new Map();
  const own = { Config: { toJSON: () => ({}) } };
  const host = {
    fiber: { runtime: own },
    get: (name) => name === 'configEditor' ? { entries: () => [{ fiber: host.fiber, options: { id: 'custom-prompt-zh-entry' } }] } : undefined,
    inject: (services, callback) => callbacks.set(services[0], callback)
  };
  installSettingsHost(host, runtime);
  callbacks.get('connection')({ connection: { fetch: { register: (route) => { routes.push(route); return () => {}; } } }, effect: (setup) => setup() });
  const response = await routes[0].fetch();
  const payload = await response.json();
  check('settings: 原生已认证 Connection GET、namespace 来自实际实例', () => {
    assert.deepEqual(routes[0].methods, ['GET']);
    assert.equal(payload.namespace, 'custom-prompt-zh-entry');
    assert.ok(payload.schemaAvailable);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(!JSON.stringify(payload).includes('PRIVATE_TIMESTAMP'));
  });
  check('settings: 配置读取异常停译，不中断宿主瀑布', () => {
    const broken = new TranslationRuntime({ preferences: { get: () => { throw new Error('PRIVATE_CONFIG_DETAIL'); } } });
    assert.equal(translate('harness:identity', 'You are an AI agent powered by DeepSeek Harness.', broken.operation('assemble')), 'You are an AI agent powered by DeepSeek Harness.');
    assert.ok(broken.describe().configurationError);
    assert.ok(!JSON.stringify(broken.describe()).includes('PRIVATE_CONFIG_DETAIL'));
  });
  check('settings: 相同规则按实际阶段分别累计', () => {
    const separate = new TranslationRuntime({}, () => ({ gitbash: { version: '0.39.4' } }));
    translateGitBashText(gitbashSamples[0].text, separate.operation('assemble'));
    translateGitBashText(gitbashSamples[0].text, separate.operation('pre-step'));
    const metrics = separate.describe().entries.find((entry) => entry.id === bash.id).metrics;
    assert.equal(metrics.matched, 2);
    assert.equal(metrics.stages.assemble.matched, 1);
    assert.equal(metrics.stages['pre-step'].matched, 1);
  });
  // 用户只改自然语言措辞，也不能让内置句子裁剪失效；保存值不迁移、不丢弃。
  const customJobs = '处理任务后，不再需要的任务请用 job_kill 取消。';
  const customPlan = '自定义计划中禁止 todo_write。';
  const protectedPreferences = { overrides: { 'core:tool:jobs': customJobs, 'core:plan-paragraph-3': customPlan, [identity.id]: '其他自定义条目不受影响。' } };
  let assemble, statusRoute;
  apply({
    get: () => undefined,
    on: (event, listener) => { if (event === 'system-prompt/assemble') assemble = listener; },
    inject: (keys, callback) => {
      if (keys[0] === 'connection') callback({ connection: { fetch: { register: (route) => { statusRoute = route; return () => {}; } } }, effect: (setup) => setup() });
    }
  }, { preferences: protectedPreferences });
  const sourceSections = [
    { name: 'tool:jobs', text: 'Track every background job id you start.' },
    { name: 'plan:policy', text: 'The tool catalog stays the same across modes for request-cache stability.' },
    { name: 'harness:identity', text: 'You are an AI agent powered by DeepSeek Harness.' }
  ];
  const protectedAssembly = await assemble({}, {}, async () => ({ sections: sourceSections, contexts: [], tools: [{ name: 'job_output' }] }));
  const protectedStatus = await (await statusRoute.fetch()).json();
  check('settings: 自定义措辞在缺工具时回退内置再裁剪，保留保存值和独立覆盖', () => {
    assert.ok(!protectedAssembly.sections.find((row) => row.name === 'tool:jobs').text.includes('job_kill'));
    assert.ok(!protectedAssembly.sections.find((row) => row.name === 'plan:policy').text.includes('todo_write'));
    assert.equal(protectedAssembly.sections.find((row) => row.name === 'harness:identity').text, '其他自定义条目不受影响。');
    assert.equal(protectedPreferences.overrides['core:tool:jobs'], customJobs);
    assert.equal(protectedStatus.entries.find((row) => row.id === 'core:tool:jobs').metrics.defaulted, 1);
    assert.equal(protectedStatus.entries.find((row) => row.id === 'core:plan-paragraph-3').metrics.stages.assemble.defaulted, 1);
  });
  const fullAssembly = await assemble({}, {}, async () => ({ sections: sourceSections, contexts: [], tools: ['job_output', 'job_kill', 'todo_write', 'ask_user_question'].map((name) => ({ name })) }));
  check('settings: 工具齐全后继续使用原自定义译文，不改条目 ID', () => {
    assert.equal(fullAssembly.sections.find((row) => row.name === 'tool:jobs').text, customJobs);
    assert.equal(fullAssembly.sections.find((row) => row.name === 'plan:policy').text, customPlan);
  });
  const client = loadClient();
  const controller = client.createDraftController();
  let writes = 0;
  let snapshot = { status: 'ready', revision: 4, value: { preferences: { disabledComponents: [], overrides: {} } } };
  controller.observe(snapshot);
  controller.edit(identity, '页面保存后真正使用的文字。');
  controller.restore();
  check('client: 还原只改草稿，不写宿主', () => {
    assert.equal(writes, 0);
    assert.equal(controller.getSnapshot().draft.overrides[identity.id], undefined);
    assert.ok(controller.getSnapshot().message.includes('点击保存'));
  });
  controller.edit(identity, '页面保存后真正使用的文字。');
  let sentRevision;
  const form = {
    getSnapshot: () => snapshot,
    mutate: async (operations, revision) => {
      writes++; sentRevision = revision;
      preferences = operations[0].value;
      snapshot = { ...snapshot, revision: 5, value: { preferences } };
      return true;
    }
  };
  const accepted = await controller.save(form, rows);
  check('client: 固定修订号保存后实际引擎输出改变，未伪造匹配信号', () => {
    assert.ok(accepted);
    assert.equal(sentRevision, 4);
    assert.equal(writes, 1);
    assert.equal(translate('harness:identity', 'You are an AI agent powered by DeepSeek Harness.', runtime.operation('test')), '页面保存后真正使用的文字。');
    assert.ok(controller.getSnapshot().message.includes('保存成功不代表'));
    assert.ok(!controller.getSnapshot().dirty);
  });
  controller.edit(identity, '不能丢失的草稿。');
  const refused = await controller.save({ ...form, mutate: async () => false }, rows);
  check('client: 被拒绝／并发冲突保留草稿，不显示成功', () => {
    assert.equal(refused, false);
    assert.equal(controller.getSnapshot().draft.overrides[identity.id], '不能丢失的草稿。');
    assert.ok(controller.getSnapshot().conflict);
    assert.ok(controller.getSnapshot().error);
    assert.ok(!controller.getSnapshot().message);
  });
  controller.reload(snapshot);
  controller.edit(identity, '加载中不能被远端覆盖。');
  controller.observe({ ...snapshot, revision: 6 });
  check('client: 远端修订变化不覆盖编辑中的草稿', () => {
    assert.ok(controller.getSnapshot().conflict);
    assert.equal(controller.getSnapshot().draft.overrides[identity.id], '加载中不能被远端覆盖。');
  });
  return checks;
}

export function schemaChecks(z) {
  const schema = createConfigSchema(z);
  const entry = getRules().find((row) => row.component === 'time' && row.defaultText.startsWith('准备第 $1'));
  const value = { preferences: { overrides: { [entry.id]: '$3，第 $1 轮 $2 步。' }, disabledComponents: [] } };
  assert.ok(schema(value).preferences.get());
  const plain = JSON.parse(JSON.stringify(schema.toJSON()));
  const strip = (node) => { if (node.meta) delete node.meta.volatile; Object.values(node.dict || {}).forEach(strip); if (node.inner) strip(node.inner); if (node.sKey) strip(node.sKey); (node.list || []).forEach(strip); };
  strip(plain);
  const rehydrated = new z(plain);
  assert.ok(rehydrated(value));
  assert.throws(() => schema({ preferences: { overrides: { [entry.id]: '丢失捕获' } } }));
  assert.throws(() => schema({ preferences: { overrides: { unknown: '文本' } } }));
  assert.throws(() => schema({ preferences: { disabledComponents: ['unknown'] } }));
  assert.throws(() => rehydrated({ preferences: { overrides: { unknown: '文本' } } }));
  assert.throws(() => rehydrated({ preferences: { overrides: { [entry.id]: '丢失捕获' } } }));
  assert.ok(!JSON.stringify(plain).includes('normalizePreferences'));
  assert.ok(!JSON.stringify(plain).includes('$3，第 $1 轮 $2 步。'));
  return schema;
}
