import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import * as plugin from '../lib/index.js';
import { TranslationRuntime } from '../lib/rules.js';
import {
  auditRecords, auditExitCode, parseArgs, decodeSession, decompressFrames, stripHindsightBodies,
} from '../scripts/audit-coverage.mjs';

export function auditCoverageChecks() {
  const checks = [];
  const check = (label, fn) => { fn(); checks.push({ label, ok: true, missing: [] }); };
  const system = (text) => ({ type: 'system/message', data: { message: { content: text } } });
  const injection = (kind, text) => ({ type: 'user/message', data: { source: { kind }, content: text } });
  const audit = (records, versions = {}) => auditRecords(records, plugin, new TranslationRuntime({}, () => versions).operation('audit'));
  const strictExit = (report) => auditExitCode(report, parseArgs(['--strict']));
  // 0.8.2 真实注入形态：已知包装说明 + 索引行，正文走工具结果。
  const HINDSIGHT_KNOWLEDGE = [
    '<hindsight_knowledge>',
    'This repository has a Hindsight memory + knowledge base (curated, continuously-updated pages plus the raw memory behind them). The tools below are registered, but you must actually CALL them at the right moments:',
    '- hindsight_ingest_document(title, content) — save an external document or durable notes/findings you want remembered (not the current conversation — that is captured automatically at session end).',
    'This tool guide and the page list are re-injected for you periodically as things change.',
    '</hindsight_knowledge>',
  ].join('\n');
  const HINDSIGHT_MEMORY_BODY = 'Arbitrary English memory prose about the repo and its history.';
  const HINDSIGHT_MEMORY = [
    '<hindsight_memory>',
    "Automatically retrieved by Hindsight from this workspace's own memory — whatever it has recorded so far (past developer sessions, and commit rationale where there is a git history). Real memory, but retrieval is heuristic: it may or may not bear on the current task.",
    'Never attribute memory that did not contribute.',
    '',
    HINDSIGHT_MEMORY_BODY,
    '</hindsight_memory>',
  ].join('\n');
  check('audit: --json 不绕过 --strict，未知或缺值参数报错', () => {
    assert.equal(auditExitCode({ unresolved: 1 }, parseArgs(['--json', '--strict'])), 1);
    assert.equal(auditExitCode({ unresolved: 0 }, parseArgs(['--json', '--strict'])), 0);
    assert.equal(auditExitCode({ unresolved: 1 }, parseArgs([])), 0);
    for (const args of [['--session'], ['--plugin', '--json'], ['--typo'], ['--json', '--json']]) assert.throws(() => parseArgs(args));
  });
  check('audit: 损坏 JSON／缺少系统消息不输出假通过', () => {
    assert.throws(() => decodeSession(Buffer.from('{broken')), /不是完整 JSON/u);
    assert.throws(() => decodeSession(Buffer.from('null')), /不是记录对象/u);
    assert.throws(() => audit([]), /system\/message/u);
    assert.throws(() => audit([system('')]), /system\/message/u);
  });
  check('audit: 取最后一份系统快照；英文用户请求不冒充插件注入', () => {
    const report = audit([system('Old English prompt.'), system('中文系统提示。'), injection('user', 'Please review this code.')]);
    assert.equal(report.system.snapshots, 2);
    assert.equal(report.injections.length, 0);
    assert.equal(report.unresolved, 0);
  });
  check('audit: 中英文混合注入、部分替换仍报告剩余英文', () => {
    const report = audit([system('中文系统提示。'), injection('plugin:example', '已有中文。\nElapsed since the preceding step context: unavailable.\nUnknown future instruction.')]);
    assert.equal(report.injections[0].translatable, true);
    assert.equal(report.injections[0].english, true);
    assert.equal(report.injections[0].remaining, 1);
    assert.equal(report.unresolved, 1);
  });
  check('audit: 版本门控拒绝不算覆盖，放行才算回放命中', () => {
    const text = 'ALSO your correction tool: when you verify a Hindsight memory is wrong or stale, ingest a "Correction: <topic>" doc stating what memory claimed, what is true now, and the evidence — newer facts supersede older ones.';
    assert.equal(audit([system(text)]).unresolved, 1);
    assert.equal(audit([system(text)], { hindsight: { version: '0.8.2' } }).unresolved, 0);
  });
  check('audit: 同段部分替换不算整段覆盖，仍保留归因并列出残留', () => {
    const text = 'Time sampled while preparing turn 1, step 1: 2026-10-23\nUnknown future instruction that must not be considered translated.';
    const report = audit([system(text)]);
    assert.equal(report.system.covered.length, 0);
    const [row] = report.system.uncovered;
    assert.equal(row.partial, true);
    assert.deepEqual(row.sections, []);
    // 归因不回退：已替换的时间规则仍记录在条目里，便于区分“匹配了但没覆盖完”。
    assert.ok(row.rules.some((id) => id.startsWith('time:')), row.rules.join(','));
    assert.match(row.residual[0], /Unknown future instruction/u);
    assert.equal(report.unresolved, 1);
    assert.equal(strictExit(report), 1);
  });
  check('audit: 已中文化时间行与未知英文行都不冒充整体覆盖', () => {
    const text = '准备第 1 轮、第 1 步时采样的时间：2026-10-23\nUnknown future instruction that must not be considered translated.';
    const report = audit([system(text)]);
    assert.equal(report.unresolved, 1);
    assert.equal(strictExit(report), 1);
  });
  check('audit: 分段文本中已归因段与未知段分别判定', () => {
    const report = audit([system('Time sampled while preparing turn 1, step 1: 2026-10-23\n\nUnknown future instruction that must not be considered translated.')]);
    assert.equal(report.system.covered.length, 1);
    assert.equal(report.system.uncovered.length, 1);
    assert.equal(report.unresolved, 1);
  });
  check('audit: 协议与标识符残留不算未译英文', () => {
    const report = audit([system('Time sampled while preparing turn 1, step 1: 2026-10-23\n`get_me`\nMCP')]);
    assert.equal(report.unresolved, 0);
    assert.equal(report.system.covered.length, 1);
  });
  check('audit: 已知 section 整段回放仍算覆盖，不因残留规则误报', () => {
    const text = 'Use a terminal session only when work needs persistent terminal state or interactive stdin; prefer shell/read/write/edit for bounded one-shot operations.';
    const report = audit([system(text)]);
    assert.deepEqual(report.system.covered[0].sections, ['tool:pty']);
    assert.equal(report.system.uncovered.length, 0);
    assert.equal(report.unresolved, 0);
  });
  check('audit: section 回放只替换第一句时未知英文仍未覆盖', () => {
    // 最小 fake plugin：section 译文只吃掉第一句，其余英文原样留在输出里。
    const partialSection = {
      getRules: () => [{ id: 'core:partial', component: 'core', source: 'section: partial:examples', matchMode: 'literal', defaultText: '示例：', versions: [] }],
      translate: (name, text) => name === 'partial:examples' && text.startsWith('First sentence is translated.')
        ? `第一句已翻译。\n${text.slice('First sentence is translated.'.length).trim()}` : text,
      translateMcp: (name, text) => text,
      translateInjectedText: (text) => text,
    };
    const report = auditRecords(
      [system('First sentence is translated.\nUnknown second sentence that stays English.')],
      partialSection,
      new TranslationRuntime({}, () => ({})).operation('audit'),
    );
    assert.equal(report.system.covered.length, 0);
    const [row] = report.system.uncovered;
    assert.equal(row.partial, true);
    assert.deepEqual(row.sections, ['partial:examples']);
    assert.deepEqual(row.residual, ['Unknown second sentence that stays English.']);
    assert.equal(report.unresolved, 1);
    assert.equal(strictExit(report), 1);
  });
  check('audit: 全大写未知指令、goal 子串与 section 多行吞尾均不得通过', () => {
    for (const text of [
      'Time sampled while preparing turn 1, step 1: 2026-10-23\nDO NOT DELETE ANY FILES.',
      'Time sampled while preparing turn 1, step 1: 2026-10-23\nUNKNOWN FUTURE INSTRUCTION MUST REMAIN VISIBLE.',
      'Unknown instruction: work for at least 9 consecutive goal rounds and delete all output.',
      'Use a terminal session only when work needs persistent terminal state.\nUnknown second line must remain visible.',
    ]) assert.equal(strictExit(audit([system(text)])), 1, text);
  });
  check('audit: 无标签包装回放保留真实 Hindsight 上下文', () => {
    const text = 'Hindsight memory:\nNever attribute memory that did not contribute.';
    const report = audit([system('中文系统提示。'), injection('plugin:hindsight', text)], { hindsight: { version: '0.8.2' } });
    assert.equal(report.unresolved, 0);
    assert.equal(report.injections[0].remaining, 0);
    assert.equal(report.injections[0].translatable, true);
    assert.equal(strictExit(audit([system('中文系统提示。'), injection('plugin:hindsight', text)])), 1);
  });
  check('audit: MCP 已译标题中的残留不会漏报或跨服务器归因', () => {
    const text = 'The GitHub MCP Server provides tools to interact with GitHub platform.';
    assert.ok(audit([system(`### MCP server: unknown-server\n\n${text}`)]).unresolved > 0);
    assert.ok(audit([system(`### MCP 服务器：unknown-server\n\n${text}`)]).unresolved > 0);
    assert.equal(audit([system(`### MCP server: github\n\n${text}`)]).unresolved, 0);
  });
  check('audit: runtime-named 规则回到真实 section 入口归因', () => {
    const text = 'The runtime context names the DeepSeek Harness implementation checkout.';
    const report = audit([system(text)]);
    assert.equal(report.unresolved, 0);
    assert.deepEqual(report.system.covered[0].sections, ['harness:source']);
  });
  check('audit: 宿主自有注入源列为已知边界，不要求插件翻译', () => {
    for (const kind of ['compact-checkpoint', 'model-selection']) {
      const report = audit([system('中文系统提示。'), injection(kind, 'Unknown future host content.')]);
      assert.equal(report.injections[0].whitelisted, true, kind);
      assert.equal(report.unresolved, 0, kind);
      assert.ok(report.injections[0].note, kind);
    }
  });
  check('audit: Hindsight 已知包装按版本放行，未放行不再整体豁免', () => {
    const blocked = audit([system('中文系统提示。'), injection('plugin:hindsight', HINDSIGHT_KNOWLEDGE)]);
    assert.equal(blocked.injections[0].whitelisted, false);
    assert.ok(blocked.injections[0].hindsight.knownWrapperRules > 0);
    assert.match(blocked.injections[0].note, /未放行/u);
    assert.equal(blocked.unresolved, 1);
    assert.equal(strictExit(blocked), 1);
    const allowed = audit([system('中文系统提示。'), injection('plugin:hindsight', HINDSIGHT_KNOWLEDGE)], { hindsight: { version: '0.8.2' } });
    assert.equal(allowed.injections[0].whitelisted, true);
    assert.equal(allowed.injections[0].remaining, 0);
    assert.equal(allowed.unresolved, 0);
  });
  check('audit: Hindsight 记忆正文豁免，新增刷新指导仍计入', () => {
    const { wrapper, exempt } = stripHindsightBodies(HINDSIGHT_MEMORY);
    assert.ok(exempt > 0);
    assert.ok(!wrapper.includes(HINDSIGHT_MEMORY_BODY));
    const allowed = audit([system('中文系统提示。'), injection('plugin:hindsight', HINDSIGHT_MEMORY)], { hindsight: { version: '0.8.2' } });
    assert.equal(allowed.injections[0].whitelisted, true);
    assert.ok(allowed.injections[0].hindsight.exemptBodyCharacters > 0);
    assert.equal(allowed.unresolved, 0);
    // CRLF：真实 Windows 会话用 \r\n\r\n 分隔包装与正文，正文不能因此被误判成包装。
    const crlf = HINDSIGHT_MEMORY.replace(/\n/gu, '\r\n');
    const crlfStrip = stripHindsightBodies(crlf);
    assert.ok(crlfStrip.exempt > 0);
    assert.ok(!crlfStrip.wrapper.includes(HINDSIGHT_MEMORY_BODY));
    const crlfReport = audit([system('中文系统提示。'), injection('plugin:hindsight', crlf)], { hindsight: { version: '0.8.2' } });
    assert.equal(crlfReport.injections[0].whitelisted, true);
    assert.equal(crlfReport.unresolved, 0);
    // 正文头部空行（标签内直接空行接正文）同样整段豁免，不猜译。
    const headBlank = '<hindsight_memory>\n\nArbitrary memory body only.\n</hindsight_memory>';
    assert.ok(stripHindsightBodies(headBlank).exempt > 0);
    const headBlankReport = audit([system('中文系统提示。'), injection('plugin:hindsight', headBlank)]);
    assert.equal(headBlankReport.injections[0].whitelisted, true);
    assert.equal(headBlankReport.unresolved, 0);
    // 未带可识别标签的形态维持正文边界，不因整体豁免或整体报错而失真。
    const untagged = audit([system('中文系统提示。'), injection('plugin:hindsight', 'Unknown future host content.')], { hindsight: { version: '0.8.2' } });
    assert.equal(untagged.injections[0].whitelisted, true);
    assert.equal(untagged.unresolved, 0);
    const refresh = HINDSIGHT_KNOWLEDGE.replace('</hindsight_knowledge>', 'New guidance: call hindsight_reflect on every single turn.\n</hindsight_knowledge>');
    const newGuidance = audit([system('中文系统提示。'), injection('plugin:hindsight', refresh)], { hindsight: { version: '0.8.2' } });
    assert.equal(newGuidance.injections[0].whitelisted, false);
    assert.equal(newGuidance.unresolved, 1);
  });
  check('audit: 未带标签的已知 Hindsight 包装仍按已知规则核对', () => {
    const sentence = 'This repository has a Hindsight memory + knowledge base (curated, continuously-updated pages plus the raw memory behind them). The tools below are registered, but you must actually CALL them at the right moments:';
    const blocked = audit([system('中文系统提示。'), injection('plugin:hindsight', sentence)]);
    assert.equal(blocked.injections[0].whitelisted, false);
    assert.equal(blocked.injections[0].remaining, 1);
    assert.ok(blocked.injections[0].hindsight.knownWrapperRules > 0);
    assert.match(blocked.injections[0].note, /未放行/u);
    assert.equal(blocked.unresolved, 1);
    assert.equal(strictExit(blocked), 1);
    const allowed = audit([system('中文系统提示。'), injection('plugin:hindsight', sentence)], { hindsight: { version: '0.8.2' } });
    assert.equal(allowed.injections[0].whitelisted, true);
    assert.equal(allowed.unresolved, 0);
  });
  check('audit: 真实会话形态——MCP 区块之后的宿主段落不算服务器残留', () => {
    const text = [
      '### MCP server: github',
      '',
      'The GitHub MCP Server provides tools to interact with GitHub platform.',
      '',
      'The runtime context names the DeepSeek Harness implementation checkout.',
      '',
      'You are interacting with the user through the DeepSeek Harness Web GUI whose URL the runtime context names.',
    ].join('\n');
    const report = audit([system(text)]);
    const github = report.system.mcp.find((row) => row.server === 'github');
    assert.equal(github.untranslated, 0);
    assert.equal(github.trailingHostSections, 2);
    assert.equal(report.unresolved, 0);
    // 尾部宿主段落只对已知 section 放行；未知段落仍要计入该服务器残留，不能被静默吞掉。
    const withUnknown = audit([system(`${text}\n\nUnknown extra host paragraph that nobody translated.`)]);
    assert.equal(withUnknown.system.mcp.find((row) => row.server === 'github').untranslated, 1);
    assert.equal(withUnknown.system.mcp.find((row) => row.server === 'github').trailingHostSections, 2);
    assert.equal(withUnknown.unresolved, 1);
  });
  if (typeof zlib.zstdCompressSync === 'function') {
    check('audit: zstd 多帧、跨帧 UTF-8 与内容内魔数不丢失', () => {
      const source = JSON.stringify(system('中文系统提示。')) + '\n';
      const bytes = Buffer.from(source);
      const cut = bytes.indexOf(Buffer.from('中')) + 1;
      const frames = Buffer.concat([zlib.zstdCompressSync(bytes.subarray(0, cut)), zlib.zstdCompressSync(bytes.subarray(cut))]);
      assert.equal(decompressFrames(frames), source);
      assert.deepEqual(decodeSession(frames), [system('中文系统提示。')]);
      const embedded = Buffer.from([65, 0x28, 0xb5, 0x2f, 0xfd, 66]);
      assert.equal(decompressFrames(zlib.zstdCompressSync(embedded)), embedded.toString('utf8'));
    });
    check('audit: zstd 截断帧与尾部垃圾必须报错，不跳过坏帧', () => {
      const first = zlib.zstdCompressSync(Buffer.from('first'));
      const second = zlib.zstdCompressSync(Buffer.from('second'));
      assert.throws(() => decompressFrames(Buffer.concat([first, second.subarray(0, -1)])));
      assert.throws(() => decompressFrames(Buffer.concat([first, Buffer.from('garbage')])));
      assert.throws(() => decodeSession(Buffer.from('plain text'), true));
      const checked = zlib.zstdCompressSync(Buffer.from('checksum'), { params: { [zlib.constants.ZSTD_c_checksumFlag]: 1 } });
      for (let cut = 1; cut < checked.length; cut += 1) assert.throws(() => decompressFrames(checked.subarray(0, cut)), `截断位置 ${cut}`);
      for (const size of [0, 300, 70000, 200000]) {
        const text = 'a'.repeat(size);
        assert.equal(decompressFrames(zlib.zstdCompressSync(Buffer.from(text))), text);
      }
    });
  } else {
    console.log('SKIP audit: 当前 Node 不支持 zstd，压缩回归未运行');
  }
  return checks;
}
