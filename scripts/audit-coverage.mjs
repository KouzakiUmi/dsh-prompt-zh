// 只读巡检：回放一份会话中的最后一份 system prompt 与注入消息。
// 输出是启发式归因，不是最终请求覆盖率；不读 Profile 配置，不发网络、不写会话。
// 用法：node scripts/audit-coverage.mjs [--session file] [--plugin dir] [--profile dir] [--json] [--strict]
// .jsonl 可用 Node 18+；.jsonl.zstd 需要带 zstd 支持的 Node（22.15+）。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const INJECTION_NOTES = {
  'runtime-context': '宿主在 pre-step 之后 refreshContext 重算，插件没有合法拦截点',
  'skill-catalog': '技能摘要和正文按设计不做通用翻译',
  'agent-instructions': '用户自己的指令正文不做通用翻译',
  'compact-checkpoint': '会话压缩摘要由宿主生成，内容是历史对话本身，不属于提示词',
  'model-selection': '模型切换通知由宿主生成，不是提示词',
};
// Hindsight 注入既带已知包装说明，也带任意记忆/知识正文，因此不能整类豁免：
// 包装按已知规则与版本门控核对，正文按标签结构豁免（见 stripHindsightBodies）。
const HINDSIGHT_NOTE = '记忆正文与知识正文按设计不翻译；包装说明按已知规则核对';
const HINDSIGHT_GATED_NOTE = '已知包装说明未放行：组件关闭或版本不在基线';
const isInjectionWhitelisted = (kind) => kind.startsWith('tool-') || Object.hasOwn(INJECTION_NOTES, kind);
const FRAME = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

export function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const name = argv[i].replace(/^--/u, '');
    if (!argv[i].startsWith('--') || !['session', 'plugin', 'profile', 'json', 'strict'].includes(name)) {
      throw new Error(`未知参数：${argv[i]}`);
    }
    if (Object.hasOwn(options, name)) throw new Error(`参数重复：--${name}`);
    if (name === 'json' || name === 'strict') options[name] = true;
    else {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`--${name} 缺少值`);
      options[name] = argv[++i];
    }
  }
  return options;
}

// 仅解析标准 zstd 帧边界；内容解压与校验仍由 zlib 执行。
// RFC 8878 §3.1.1.1–2：https://www.rfc-editor.org/rfc/rfc8878.html#section-3.1.1
// 某些 Node 版本对截断帧不报错，因此在解压之前验证完整头、块和可选校验和。
function frameEnd(buffer, start) {
  let cursor = start;
  const advance = (size) => {
    if (cursor + size > buffer.length) throw new Error(`zstd 帧未写完，字节偏移 ${start}`);
    const previous = cursor;
    cursor += size;
    return previous;
  };
  const magic = advance(4);
  if (!buffer.subarray(magic, cursor).equals(FRAME)) throw new Error(`无效或不支持的 zstd 帧，字节偏移 ${start}`);
  const descriptor = buffer[advance(1)];
  if (descriptor & 8) throw new Error(`zstd 帧使用保留位，字节偏移 ${start}`);
  const single = Boolean(descriptor & 32);
  const sizeFlag = descriptor >>> 6;
  advance((single ? 0 : 1) + [0, 1, 2, 4][descriptor & 3] + (sizeFlag === 0 ? Number(single) : [0, 2, 4, 8][sizeFlag]));
  let last;
  do {
    const header = buffer.readUIntLE(advance(3), 3);
    last = Boolean(header & 1);
    const type = (header >>> 1) & 3;
    if (type === 3) throw new Error(`zstd 块使用保留类型，字节偏移 ${start}`);
    advance(type === 1 ? 1 : header >>> 3);
  } while (!last);
  if (descriptor & 4) advance(4);
  return cursor;
}

export function decompressFrames(buffer) {
  if (typeof zlib.zstdDecompressSync !== 'function') throw new Error('读取压缩会话需要支持 zstd 的 Node（22.15+）');
  const parts = [];
  let offset = 0;
  while (offset < buffer.length) {
    const end = frameEnd(buffer, offset);
    try { parts.push(zlib.zstdDecompressSync(buffer.subarray(offset, end))); }
    catch { throw new Error(`zstd 帧解压失败，字节偏移 ${offset}`); }
    offset = end;
  }
  return Buffer.concat(parts).toString('utf8');
}

export function decodeSession(raw, compressed = false) {
  const isZstd = raw.subarray(0, FRAME.length).equals(FRAME);
  const text = compressed || isZstd ? decompressFrames(raw) : raw.toString('utf8');
  const records = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    let record;
    try { record = JSON.parse(line); }
    catch { throw new Error(`会话第 ${index + 1} 行不是完整 JSON；停止巡检，不能把缺失记录视为通过`); }
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`会话第 ${index + 1} 行不是记录对象`);
    records.push(record);
  }
  return records;
}

function latestSession() {
  const root = join(homedir(), '.dsh', 'sessions');
  let best;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else if (/\.(?:jsonl\.zstd|jsonl)$/u.test(name) && (!best || stat.mtimeMs > best.mtime)) best = { path, mtime: stat.mtimeMs };
    }
  };
  walk(root);
  return best?.path;
}
function textOf(content) {
  if (Array.isArray(content)) return content.map((part) => typeof part?.text === 'string' ? part.text : '').join('\n');
  return typeof content === 'string' ? content : '';
}
function readVersions(profileDir) {
  const versions = {};
  const packages = { gitbash: 'dsh-gitbash-shell', hindsight: '@vectorize-io/hindsight-coding-agents' };
  for (const [id, name] of Object.entries(packages)) {
    try {
      const manifest = JSON.parse(readFileSync(join(profileDir, 'node_modules', name, 'package.json'), 'utf8'));
      if (manifest.name === name && typeof manifest.version === 'string') versions[id] = { status: 'resolved', version: manifest.version };
    } catch { versions[id] = { status: 'unavailable' }; }
  }
  return versions;
}
function regexOf(source) {
  if (typeof source !== 'string' || !source.startsWith('/')) return undefined;
  const end = source.lastIndexOf('/');
  if (end <= 0) return undefined;
  try { return new RegExp(source.slice(1, end), source.slice(end + 1).replace(/[gy]/gu, '')); }
  catch { return undefined; }
}
// 混合语言消息不能只因包含一个汉字就整条跳过；按行提取并合并连续英文行。
// 同一行内的中英混排、代码及产品名仍需人工复核，不据此声称全量覆盖。
export function englishFragments(text) {
  return text.split(/\r?\n/u).map((line) =>
    /[A-Za-z]/u.test(line) && !/[\u4e00-\u9fff]/u.test(line) && !/^\s*<[^>]+>\s*$/u.test(line) ? line : ''
  ).join('\n').split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean);
}

// 回放后仍是英文的片段不能一律算漏译：工具名、参数、路径、URL、占位符、文件名与
// 驼峰/下划线标识符是插件有意保留的协议内容。只把读起来像英文句子的残留计为未覆盖。
// 这是启发式边界：一两个短词或纯单词正文可能漏判，结论仍需人工复核。
const PROTOCOL_TOKEN = /`[^`\r\n]*`|<[^<>\r\n]+>|https?:\/\/\S+|\b[\w.@-]+(?:\/[\w.@-]+)+\b|\b\w[\w-]*(?:_[\w-]+)+\b|\b[a-z][a-z0-9]*(?:[A-Z][\w]*)+|\b[A-Z][\w]*(?:[A-Z][a-z0-9][\w]*)+\b|\b(?:MCP|PTC|SDK|API|JSON|JSONL|YAML|URL|HTTP|HTTPS|UTF|ASCII|MSYS|POSIX|WMI|SQL|RST|UI|DOM)\b|\b[\w-]+\.(?:md|mjs|js|json|ya?ml|toml|txt|html?|py|sh|ps1|ts)\b/gu;
export function isIndependentEnglish(text) {
  return /\b[A-Za-z]{3,}\b/u.test(text.replace(PROTOCOL_TOKEN, ' '));
}
export function residualEnglish(text) {
  return englishFragments(text).filter(isIndependentEnglish);
}

// Hindsight 0.8.2 注入结构（已按安装副本只读核对）：
//   <hindsight_knowledge>已知前言、工具指南、索引行、尾注</hindsight_knowledge>
//   <hindsight_knowledge_refresh>已知提醒与工具指南（可附工具指南扩展）</hindsight_knowledge_refresh>
//   <hindsight_memory>已知前言…\n\n任意记忆正文…</hindsight_memory>
// 只有记忆正文（标签内第一个空行之后）按设计不翻译；知识区块自身只注入已知包装与索引行，
// 知识页正文走工具结果，属 tool-* 边界，不出现在注入里。
// 空行同时接受 LF 与 CRLF：真实 Windows 会话的正文分隔是 \r\n\r\n。
const HINDSIGHT_TAG = /<(hindsight_knowledge_refresh|hindsight_knowledge|hindsight_memory)\b[^>]*>([\s\S]*?)<\/\1>/gu;
const HINDSIGHT_BODY_BREAK = /\r?\n[ \t]*\r?\n/u;
export function stripHindsightBodies(text) {
  let exempt = 0;
  let tagged = 0;
  const wrapper = text.replace(HINDSIGHT_TAG, (match, tag, inner) => {
    tagged += 1;
    if (tag !== 'hindsight_memory') return match;
    const cut = inner.search(HINDSIGHT_BODY_BREAK);
    if (cut < 0) return match;
    exempt += inner.length - cut;
    return `<${tag}>${inner.slice(0, cut)}</${tag}>`;
  });
  return { wrapper, exempt, tagged };
}

// 未带可识别标签时形态未知：只核对其中能被已知包装规则识别的片段，
// 其余任意记忆/知识正文继续按设计豁免，避免整段正文被当成漏译。
export function knownHindsightFragment(text, rules) {
  const fragments = [];
  for (const rule of rules) {
    if (!rule.pattern) continue;
    let pattern;
    try { pattern = new RegExp(rule.pattern.source, `${rule.pattern.flags}g`); }
    catch { continue; }
    for (const match of text.matchAll(pattern)) {
      const value = match[0].trim();
      if (value) fragments.push(value);
    }
  }
  return [...new Set(fragments)].join('\n');
}

export function auditRecords(records, plugin, runtime) {
  const systems = records.filter((record) => record.type === 'system/message');
  const systemText = textOf(systems.at(-1)?.data?.message?.content);
  if (!systemText.trim()) throw new Error('未找到非空 system/message，无法作出覆盖结论');
  const ruleList = plugin.getRules().map((rule) => ({ ...rule, pattern: regexOf(rule.source) }));
  // 目录 ID 可能是变体而非实际 section 名；别把 runtime-named 后缀当成分发入口。
  const sectionNames = [...new Set(ruleList.filter((rule) => rule.component === 'core' && rule.matchMode !== 'section')
    .map((rule) => rule.source.startsWith('section: ') ? rule.source.slice(9) : rule.id.startsWith('core:') && rule.pattern ? rule.id.slice(5) : undefined)
    .filter(Boolean).map((name) => name.replace(/-runtime-named$/u, '')))]
    .filter((name) => name !== 'deployment:persona-prefix');
  const heads = [...systemText.matchAll(/^###[ \t]*MCP[ \t]+(?:server:[ \t]*|服务器：[ \t]*)([^\r\n]+)$/gimu)];
  const regions = heads.map((head, index) => ({
    server: head[1].trim(), text: systemText.slice(head.index, heads[index + 1]?.index ?? systemText.length),
  }));
  const outsideMcp = heads.length ? systemText.slice(0, heads[0].index) : systemText;
  const pending = englishFragments(outsideMcp).map((text) => ({ text }));
  const mcpReport = regions.map((region) => {
    const translated = plugin.translateMcp(`mcp:${region.server}`, region.text, runtime);
    const remaining = englishFragments(translated);
    // 记录只到下一个 MCP 标题为止，末尾可能跟着宿主自己的 section。
    // 能被宿主 section 规则命中的片段属于宿主段落，不计入该服务器的未译残留。
    const owned = remaining.filter((fragment) => !sectionNames.some((name) => plugin.translate(name, fragment, runtime) !== fragment));
    const trailing = remaining.length - owned.length;
    pending.push(...remaining.map((text) => ({ text, server: region.server })));
    return {
      server: region.server, characters: region.text.length, translated: translated !== region.text,
      untranslated: owned.length, trailingHostSections: trailing,
    };
  });
  const covered = [], uncovered = [];
  for (const { text, server } of pending) {
    const candidates = ruleList.filter((rule) => rule.pattern?.test(text)).map((rule) => rule.id);
    // 只把实际回放发生替换视为可归因；正则命中但被版本门控阻止，不算覆盖。
    const sectionReplays = sectionNames
      // 拼合后的快照没有 section 边界；按独立行近似回放，禁止前缀译文吞掉下一行未知指导。
      .map((name) => ({ name, output: text.replace(/[^\r\n]+/gu, (line) => plugin.translate(name, line, runtime)) }))
      .filter((row) => row.output !== text);
    const sections = sectionReplays.map((row) => row.name).slice(0, 3);
    // MCP 区域已经按其 server 回放；禁止去掉标题后再次跨服务器套用译表。
    const replay = server === undefined ? plugin.translateInjectedText(text, runtime) : text;
    const injected = replay !== text;
    // 只替换了一部分不算整段覆盖：逐条检查回放输出里的英文残留，
    // 只要有一条回放把英文清干净才算覆盖；仍有独立英文残留就计入未覆盖并保留归因。
    const injectedResidual = injected ? residualEnglish(replay) : [];
    const sectionResiduals = sectionReplays.map((row) => residualEnglish(row.output));
    const settled = (injected && injectedResidual.length === 0) || sectionResiduals.some((parts) => parts.length === 0);
    const residual = injected || sectionReplays.length > 0
      ? [...injectedResidual, ...sectionResiduals.flat()]
      : residualEnglish(text);
    const entry = { head: text.replace(/\s+/gu, ' ').slice(0, 70), characters: text.length, rules: candidates, sections, server };
    if (settled) covered.push(entry);
    else uncovered.push({
      ...entry, partial: sections.length > 0 || injected,
      residual: [...new Set(residual.map((part) => part.replace(/\s+/gu, ' ').slice(0, 70)))],
    });
  }
  const hindsightRules = ruleList.filter((rule) => rule.component === 'hindsight');
  const injections = records.filter((record) => record.type === 'user/message' && record.data?.source?.kind !== 'user').map((record) => {
    const content = textOf(record.data?.content);
    const kind = record.data?.source?.kind ?? 'unknown';
    const hindsight = kind === 'plugin:hindsight';
    // Hindsight 注入把已知包装与任意正文混在一条消息里：正文按标签结构豁免，包装照常核对。
    const { wrapper, exempt, tagged } = hindsight ? stripHindsightBodies(content) : { wrapper: content, exempt: 0, tagged: 0 };
    // 无可识别标签时形态未知：只核对能被已知包装规则识别的片段，任意记忆/知识正文继续豁免。
    const checked = hindsight && tagged === 0 ? knownHindsightFragment(content, hindsightRules) : wrapper;
    // 无标签形态也必须在原始上下文中回放：抽取可能移除翻译器需要的 Hindsight 标记。
    const translated = hindsight && tagged === 0
      ? knownHindsightFragment(plugin.translateInjectedText(content, runtime), hindsightRules)
      : plugin.translateInjectedText(checked, runtime);
    const residual = residualEnglish(translated);
    // 命中已知包装却仍未放行（组件关闭或版本不在基线）时，说明英文包装会原样进入请求。
    const knownWrapperRules = hindsight ? hindsightRules.filter((rule) => rule.pattern?.test(wrapper)).length : 0;
    const gated = hindsight && knownWrapperRules > 0 && !runtime.enabled('hindsight');
    const whitelisted = isInjectionWhitelisted(kind) || (hindsight && residual.length === 0 && !gated);
    return {
      seq: record.seq, kind, characters: content.length, translatable: translated !== checked,
      english: englishFragments(checked).length > 0, remaining: residual.length,
      whitelisted, note: gated ? HINDSIGHT_GATED_NOTE : hindsight ? HINDSIGHT_NOTE : INJECTION_NOTES[kind],
      ...(hindsight ? { hindsight: { wrapperCharacters: wrapper.length, exemptBodyCharacters: exempt, knownWrapperRules } } : {}),
    };
  });
  return {
    versions: runtime.versions,
    system: {
      characters: systemText.length, snapshots: systems.length,
      paragraphs: systemText.split(/\n\s*\n/u).filter((p) => p.trim()).length,
      english: { paragraphs: pending.length, mcpBlocks: regions.length, characters: pending.reduce((n, p) => n + p.text.length, 0) },
      covered, uncovered, mcp: mcpReport,
    },
    injections,
    unresolved: uncovered.length + injections.filter((row) => row.remaining > 0 && !row.whitelisted).length,
  };
}

export function auditExitCode(report, options) {
  return options.strict && report.unresolved > 0 ? 1 : 0;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const sessionPath = options.session ?? latestSession();
  if (!sessionPath) throw new Error('未找到会话文件，请用 --session 指定');
  const pluginDir = resolve(options.plugin ?? '.');
  const profileDir = options.profile ?? join(homedir(), '.dsh', 'profiles', 'desktop');
  const plugin = await import(pathToFileURL(join(pluginDir, 'lib', 'index.js')).href);
  const { TranslationRuntime } = await import(pathToFileURL(join(pluginDir, 'lib', 'rules.js')).href);
  const runtime = new TranslationRuntime({}, () => readVersions(profileDir)).operation('audit');
  const records = decodeSession(readFileSync(sessionPath), sessionPath.endsWith('.zstd'));
  const report = { session: sessionPath, plugin: pluginDir, ...auditRecords(records, plugin, runtime) };
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log('=== 提示词漏译巡检（启发式归因，默认组件配置）===');
    console.log('会话:', report.session);
    console.log('插件:', report.plugin);
    console.log('版本:', Object.entries(report.versions).map(([id, info]) => `${id}=${info.version ?? '不可核验'}`).join(', ') || '(无可核验第三方版本)');
    console.log(`\n系统提示词: ${report.system.characters} 字符 / ${report.system.paragraphs} 段（取最后一份快照）`);
    console.log(`MCP 回放后待归因英文: ${report.system.english.paragraphs} 段`);
    console.log('\nMCP 区块:');
    for (const block of report.system.mcp) console.log(`  ${block.translated ? '有替换' : '未替换'}  ${block.server} (${block.characters} 字符，区域内残留英文段 ${block.untranslated})`);
    console.log(`\n回放可归因英文段（${report.system.covered.length}）:`);
    for (const row of report.system.covered) console.log(`  [${row.sections.length ? `section 近似归因 ${row.sections.join(', ')}` : `注入规则 ${row.rules.join(', ')}`}] ${row.head}`);
    console.log(`\n未归因英文段（${report.system.uncovered.length}）:`);
    for (const row of report.system.uncovered) {
      const partial = row.partial ? '[部分替换] ' : '';
      const residual = row.residual?.length ? ` → 回放后残留 ${row.residual.length} 段（${row.residual[0]}）` : '';
      console.log(`  ${partial}${row.head}${residual}`);
    }
    console.log(`\n注入消息: ${report.injections.length} 条（不含 source.kind=user 的用户输入）`);
    for (const row of report.injections.filter((r) => r.english || r.remaining)) {
      const state = row.whitelisted ? `已知边界（${row.note ?? '工具返回值'}）` : row.remaining > 0 ? `仍有 ${row.remaining} 段待核对${row.note ? `（${row.note}）` : ''}` : '回放已替换';
      const exempt = row.hindsight?.exemptBodyCharacters ? `，正文豁免 ${row.hindsight.exemptBodyCharacters} 字符` : '';
      console.log(`  seq=${row.seq} ${row.kind} (${row.characters} 字符) → ${state}${exempt}`);
    }
    console.log(`\n结论: ${report.unresolved === 0 ? '本次启发式巡检未发现未归因项，不代表最终请求全量覆盖' : `有 ${report.unresolved} 项待人工核对`}`);
  }
  return auditExitCode(report, options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = await main(); }
  catch (error) { console.error(`巡检失败：${error.message}`); process.exitCode = 2; }
}
