import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translateMcp, translateAllMcp, translateInjectedText, translateContext, translateGitBashText, translateToolGuidance } from '../lib/index.js';
import { TranslationRuntime } from '../lib/rules.js';

export const blenderEnglish = readFileSync(new URL('./fixtures/blender.md', import.meta.url), 'utf8');
export const gitbashSamples = JSON.parse(readFileSync(new URL('./fixtures/gitbash.json', import.meta.url), 'utf8'));
// 与旧版 fixture 分开，保留原覆盖；原文取自 0.42.2 的 inline-tools 路由指导，不含 PTC 分支。
const gitbash0422 = JSON.parse(readFileSync(new URL('./fixtures/gitbash-0.42.2.json', import.meta.url), 'utf8'));
// 0.43.2 实际安装副本逐条比对后的原文；破折号变体已在新版移除，故不在此 fixture 中。
const gitbash0432 = JSON.parse(readFileSync(new URL('./fixtures/gitbash-0.43.2.json', import.meta.url), 'utf8'));

export async function newGuidanceChecks(assemble, preStep) {
  const results = [];
  const check = (label, assertion) => {
    assertion();
    results.push({ label, ok: true, missing: [] });
  };
  const blender = translateMcp('mcp:blender', blenderEnglish);
  check('blender: 本轮全文覆盖（保留 API 词，不残留原文指导行）', () => {
    for (const line of blenderEnglish.split(/\r?\n/u).map((s) => s.trim()).filter((s) => s.length > 15)) {
      assert.ok(!blender.includes(line), `English line remains: ${line}`);
    }
    for (const title of ['随附手册', '执行代码', '场景与数据结构', '对象类型与创建', '变换与坐标空间']) assert.ok(blender.includes(`# ${title}`));
    for (const fragment of ['未经确认，不得破坏性修改', '仅作为最后手段', '不要仅打印输出', '先检查场景单位', '编辑模式', '同步回网格', '单用户数据', '父级逆矩阵']) assert.ok(blender.includes(fragment));
  });
  check('blender: 标识符、目录与后缀原样保留', () => {
    for (const match of blenderEnglish.matchAll(/`([^`]+)`/gu)) assert.ok(blender.includes(match[0]), `identifier lost: ${match[0]}`);
    for (const value of ['.blend', 'Euler', 'Quaternion', 'Axis-Angle', 'Grease Pencil', 'Object', 'Edit', 'Sculpt']) assert.ok(blender.includes(value));
  });
  check('blender: 重入和 CRLF／折行一致', () => {
    assert.equal(translateMcp('mcp:blender', blender), blender);
    assert.equal(translateMcp('mcp:blender', blenderEnglish.replaceAll('\n', '\r\n')).replaceAll('\r\n', '\n'), blender);
    assert.ok(translateMcp('mcp:blender', blenderEnglish.replace('type\n    properties', 'type properties')).includes('枚举值'));
  });
  check('blender: 组合 MCP 不影响其他服务器的同名标题／规则', () => {
    const other = '### MCP server: other\n\n# Executing Code\nHierarchy:\nDo not destructively modify objects without confirmation.';
    const combined = translateAllMcp(`${other}\n\n${blenderEnglish}\n${other}`);
    const retained = other.replace('### MCP server: other', '### MCP 服务器：other');
    assert.ok(combined.startsWith(retained));
    assert.ok(combined.endsWith(retained));
    assert.ok(combined.includes('# 执行代码'));
    assert.equal(translateAllMcp(combined), combined);
  });
  check('blender: 未知追加段落、近似服务器名称与无关正文保守保留', () => {
    const unknown = 'Unknown future Blender policy: Hierarchy: and Strategies: must stay untouched.';
    assert.ok(translateMcp('mcp:blender', blenderEnglish + unknown).endsWith(unknown));
    assert.equal(translateMcp('mcp:blender', '# Executing Code\nUnrelated documentation.'), '# Executing Code\nUnrelated documentation.');
    const renamed = blenderEnglish.replace('MCP server: blender', 'MCP server: blender-extra');
    assert.ok(translateAllMcp(renamed).includes('You have access to Blender tools'));
  });
  check('blender: 无标题的明确正文及消息注入链路', () => {
    const body = blenderEnglish.slice(blenderEnglish.indexOf('You have access'));
    assert.ok(translateAllMcp(body).startsWith('你可以使用 Blender 工具'));
    assert.equal(translateInjectedText(blenderEnglish), blender);
  });
  for (const sample of gitbashSamples) {
    check(`gitbash: ${sample.label} 翻译／幂等／标识符`, () => {
      const output = translateGitBashText(sample.text);
      assert.notEqual(output, sample.text);
      for (const fragment of sample.expected) assert.ok(output.includes(fragment), `${sample.label}: missing ${fragment}`);
      assert.equal(translateGitBashText(output), output);
      assert.equal(translateInjectedText(sample.text), output);
      assert.equal(translateContext('gitbash-shell:posix-paths', sample.text), output);
    });
  }
  for (const sample of gitbash0422) {
    check(`gitbash 0.42.2: ${sample.label} 双管线／精确门控／幂等`, () => {
      const current = new TranslationRuntime({}, () => ({ gitbash: { version: '0.42.2' } })).operation('test');
      const previous = new TranslationRuntime({}, () => ({ gitbash: { version: '0.39.4' } })).operation('test');
      const output = translateGitBashText(sample.text, current);
      assert.ok(output.includes(sample.expected));
      assert.equal(translateInjectedText(sample.text, current), output);
      assert.equal(translateGitBashText(output, current), output);
      assert.equal(translateGitBashText(sample.text, previous), sample.text);
    });
  }
  for (const sample of gitbash0432) {
    check(`gitbash 0.43.2: ${sample.label} 放行／未列版本保留／幂等`, () => {
      const current = new TranslationRuntime({}, () => ({ gitbash: { version: '0.43.2' } })).operation('test');
      const unlisted = new TranslationRuntime({}, () => ({ gitbash: { version: '0.43.1' } })).operation('test');
      const output = translateGitBashText(sample.text, current);
      assert.ok(output.includes(sample.expected));
      assert.equal(translateGitBashText(output, current), output);
      assert.equal(translateGitBashText(sample.text, unlisted), sample.text);
    });
  }
  check('gitbash: 0.42.2 破折号变体不在 0.43.2 放行范围', () => {
    const current = new TranslationRuntime({}, () => ({ gitbash: { version: '0.43.2' } })).operation('test');
    const retired = "Prefer this bash tool for shell syntax, scripts, pipelines, redirection, globbing and POSIX utilities — it is this host's shell.";
    assert.equal(translateGitBashText(retired, current), retired);
  });
  check('gitbash: 严格模式不扩展虚拟挂载支持／新版关闭与开启不混淆', () => {
    assert.ok(!translateGitBashText(gitbashSamples[1].text).includes('/tmp'));
    assert.ok(translateGitBashText(gitbashSamples[4].text).includes('尽力转换'));
    assert.ok(!translateGitBashText(gitbashSamples[4].text).includes('自动改写已关闭'));
    assert.ok(translateGitBashText(gitbashSamples[5].text).includes('自动改写已关闭'));
  });
  const schema = Object.freeze({ type: 'object', properties: Object.freeze({ command: Object.freeze({ type: 'string', description: 'The bash command to execute.', default: '/c/example' }) }) });
  const base = 'Execute a bash command (`bash -c`). Unknown base prose remains English.';
  const description = `${base}\n${gitbashSamples[9].text}\n${gitbashSamples[10].text}\n${gitbashSamples[11].text}`;
  const bash = Object.freeze({ name: 'bash', description, parameters: schema, deferLoading: true });
  const other = Object.freeze({ name: 'other', description, parameters: schema });
  const tools = Object.freeze([bash, other]);
  const localized = translateToolGuidance(tools);
  check('gitbash: 冻结 schema 安全拷贝，仅修改 bash 的已知附加说明', () => {
    assert.notEqual(localized, tools);
    assert.notEqual(localized[0], bash);
    assert.ok(localized[0].description.startsWith(base));
    assert.ok(localized[0].description.includes('本机没有 PowerShell 工具'));
    assert.equal(bash.description, description);
    assert.equal(localized[0].parameters, schema);
    assert.equal(localized[0].name, bash.name);
    assert.equal(localized[0].deferLoading, true);
    assert.equal(localized[1], other);
    assert.equal(translateToolGuidance(localized), localized);
  });
  check('gitbash: 无匹配或上游变化不分配、不猜译', () => {
    const unknown = 'This bash has a new policy not present in the dictionary.';
    const unchanged = Object.freeze([{ name: 'bash', description: unknown, parameters: schema }]);
    assert.equal(translateToolGuidance(unchanged), unchanged);
    assert.equal(translateGitBashText(unknown), unknown);
  });
  const assembly = Object.freeze({
    sections: Object.freeze([Object.freeze({ name: 'mcp:blender', text: blenderEnglish })]),
    contexts: Object.freeze([Object.freeze({ name: 'gitbash-shell:posix-paths', text: `${gitbashSamples[0].text} ${gitbashSamples[4].text}` })]),
    tools
  });
  const assembled = await assemble({}, {}, async () => assembly);
  check('wiring: MCP 已知 server 按原文守卫翻译／未核验版本仍执行／已核验 Git Bash 翻译', () => {
    const blender = assembled.sections.find((section) => section.name === 'mcp:blender').text;
    assert.notEqual(blender, blenderEnglish);
    assert.ok(blender.includes('### MCP 服务器：blender'));
    assert.ok(blender.includes('Blender 必须处于运行状态'));
    assert.ok(assembled.contexts[0].text.startsWith('当前工作 shell'));
    assert.ok(assembled.contexts[0].text.includes('尽力转换'));
    assert.ok(assembled.tools[0].description.includes('本机没有 PowerShell 工具'));
    assert.equal(assembly.contexts[0].text.startsWith('The working shell'), true);
    assert.equal(assembled.tools[0].parameters, schema);
  });
  const again = await assemble({}, {}, async () => assembled);
  check('wiring: 组装重入保留已翻译工具引用', () => {
    assert.deepEqual(again, assembled);
    assert.equal(again.tools, assembled.tools);
  });
  const message = Object.freeze({ role: 'user', content: Object.freeze([Object.freeze({ type: 'text', text: `${blenderEnglish}\n${gitbashSamples[0].text}` })]) });
  const decision = await preStep({}, async () => ({ kind: 'enter', messages: Object.freeze([message]) }));
  check('wiring: pre-step 覆盖新增文本，不改写冻结消息', () => {
    assert.ok(decision.messages[0].content[0].text.includes('# 随附手册'));
    assert.ok(decision.messages[0].content[0].text.includes('当前工作 shell'));
    assert.ok(message.content[0].text.includes('# Bundled Manuals'));
  });
  return results;
}
