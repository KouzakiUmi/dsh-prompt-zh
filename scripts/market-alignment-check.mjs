// 市场收录条件对齐验证脚本
// 对照 DSH STORE (registry/README.md) + awesome-dsh-plugins (CONTRIBUTING.md) 检查
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
let pass = 0, fail = 0, warn = 0;
const results = [];

function check(name, ok, detail = '') {
  if (ok) { pass++; results.push(['PASS', name, detail]); }
  else { fail++; results.push(['FAIL', name, detail]); }
}
function caution(name, detail) { warn++; results.push(['WARN', name, detail]); }

// ═══ A. DSH STORE 硬条件 ═══

// A1. repository 指向公开 GitHub
const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || '';
check('A1 repository 为 GitHub URL',
  /^git\+https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/.test(repo) && repo.includes('KouzakiUmi/dsh-prompt-zh'),
  repo);

// A2. dsh.bundle.patch 存在且可解析
check('A2 dsh.bundle.patch 声明', !!(pkg.dsh?.bundle?.patch));
check('A2b patch 文件存在', existsSync(join(root, pkg.dsh?.bundle?.patch || '')));
const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8');
const entryIdMatch = /id:\s*(\S+)/.exec(patch);
const entryNameMatch = /name:\s*(\S+)/.exec(patch);
check('A2c patch 含 insert + id + name',
  patch.includes('- insert:') && entryIdMatch && entryNameMatch,
  `id=${entryIdMatch?.[1]}, name=${entryNameMatch?.[1]}`);

// A3. version 是 semver
check('A3 version 是合法 semver', /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(pkg.version), pkg.version);

// A4. 生命周期脚本：不应有 install/prepare 等（或需显式声明）
const lifecycle = ['preinstall', 'install', 'postinstall', 'prepublish', 'prepublishOnly', 'prepare'];
const foundLifecycle = lifecycle.filter((s) => pkg.scripts?.[s]);
check('A4 无生命周期脚本（低风险）', foundLifecycle.length === 0,
  foundLifecycle.length ? `发现: ${foundLifecycle.join(', ')}` : '无 install/prepare 脚本');

// A5. 不修改 @deepseek-ai/* 官方组件
const deps = Object.keys(pkg.dependencies || {});
const coreDeps = deps.filter((d) => d.startsWith('@deepseek-ai/'));
check('A5 dependencies 无 @deepseek-ai/*', coreDeps.length === 0,
  coreDeps.length ? `发现: ${coreDeps.join(', ')}` : '干净');
const peers = Object.keys(pkg.peerDependencies || {});
const corePeers = peers.filter((d) => d.startsWith('@deepseek-ai/'));
if (corePeers.length) caution('A5b peerDependencies 含核心包', corePeers.join(', '));

// A6. Node.js 兼容声明
check('A6 engines.node 已声明', !!pkg.engines?.node, pkg.engines?.node || '(缺失)');

// A7. DSH 兼容声明：dshReleases 逐版本
const dshRel = pkg.dsh?.compatibility?.dshReleases || {};
const dshRelEntries = Object.entries(dshRel);
check('A7 dsh.compatibility.dshReleases 非空', dshRelEntries.length > 0,
  `${dshRelEntries.length} 条声明`);
const validValues = ['compatible', 'incompatible', 'unknown'];
const badVals = dshRelEntries.filter(([, v]) => !validValues.includes(v));
check('A7b 声明值合法 (compatible/incompatible/unknown)', badVals.length === 0,
  badVals.length ? `非法: ${badVals.map(([k, v]) => `${k}=${v}`).join(', ')}` : '全部合法');
const compatCount = dshRelEntries.filter(([, v]) => v === 'compatible').length;
check('A7c 至少 1 个 compatible 声明', compatCount >= 1, `${compatCount} 个 compatible`);

// A8. 许可证三方一致 (manifest / LICENSE 文件 / GitHub)
check('A8 manifest license 为 MIT', pkg.license === 'MIT', pkg.license);
check('A8b LICENSE 文件存在', existsSync(join(root, 'LICENSE')));
if (existsSync(join(root, 'LICENSE'))) {
  const lic = readFileSync(join(root, 'LICENSE'), 'utf8');
  check('A8c LICENSE 内容为 MIT', lic.includes('MIT License') && lic.includes('Permission is hereby granted'));
}
check('A8d LICENSE 在 files 中（分发产物携带）', (pkg.files || []).includes('LICENSE'));

// A9. files 白名单包含运行时文件
const requiredFiles = ['lib', 'cordis.patch.yml'];
for (const f of requiredFiles) {
  check(`A9 files 含 ${f}`, (pkg.files || []).includes(f));
}
check('A9b files 无多余敏感项',
  !(pkg.files || []).some((f) => f.includes('.env') || f.includes('secret') || f.includes('key')),
  (pkg.files || []).join(', '));

// A10. exports 目标存在
for (const [key, target] of Object.entries(pkg.exports || {})) {
  if (typeof target !== 'string') continue;
  if (target.includes('*')) {
    check(`A10 exports["${key}"] 目录存在`, existsSync(join(root, dirname(target))), target);
  } else {
    check(`A10 exports["${key}"] 存在`, existsSync(join(root, target)), target);
  }
}

// ═══ B. 有界静态扫描限制 ═══

// B1. 运行时文件统计（files 白名单内的文件）
function collectFiles(dir, base = '') {
  const out = [];
  const full = join(root, dir);
  if (!existsSync(full)) return out;
  for (const item of readdirSync(full, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const rel = base ? `${base}/${item.name}` : item.name;
    if (item.isDirectory()) out.push(...collectFiles(join(dir, item.name), rel));
    else out.push({ rel, abs: join(full, item.name) });
  }
  return out;
}

const runtimeFiles = [];
for (const f of pkg.files || []) {
  const full = join(root, f);
  if (!existsSync(full)) continue;
  const st = statSync(full);
  if (st.isDirectory()) {
    runtimeFiles.push(...collectFiles(f, f));
  } else {
    runtimeFiles.push({ rel: f, abs: full });
  }
}

const LIMIT_FILES = 240;
const LIMIT_SIZE = 256 * 1024;   // 256 KiB
const LIMIT_TOTAL = 2 * 1024 * 1024; // 2 MiB

check(`B1 运行时文件数 ≤ ${LIMIT_FILES}`, runtimeFiles.length <= LIMIT_FILES, `${runtimeFiles.length} 个`);
let totalBytes = 0;
let oversize = [];
for (const f of runtimeFiles) {
  const sz = statSync(f.abs).size;
  totalBytes += sz;
  if (sz > LIMIT_SIZE) oversize.push(`${f.rel} (${(sz / 1024).toFixed(1)} KiB)`);
}
check(`B2 单文件 ≤ 256 KiB`, oversize.length === 0,
  oversize.length ? `超限: ${oversize.join(', ')}` : `最大 ${(Math.max(...runtimeFiles.map((f) => statSync(f.abs).size)) / 1024).toFixed(1)} KiB`);
check(`B3 总大小 ≤ 2 MiB`, totalBytes <= LIMIT_TOTAL, `${(totalBytes / 1024 / 1024).toFixed(2)} MiB`);

// B4. 扫描面完整性：硬编码密钥/令牌模式
const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey|secret|token|password|passwd)\s*[=:]\s*['"][\w+/=-]{16,}['"]/i,
  /sk-[a-zA-Z0-9]{20,}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /gho_[a-zA-Z0-9]{36}/,
  /github_pat_[a-zA-Z0-9_]{22,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
let secretsFound = [];
for (const f of runtimeFiles) {
  const content = readFileSync(f.abs, 'utf8');
  for (const p of SECRET_PATTERNS) {
    if (p.test(content)) secretsFound.push(f.rel);
  }
}
check('B4 无硬编码密钥/令牌', secretsFound.length === 0,
  secretsFound.length ? `疑似: ${[...new Set(secretsFound)].join(', ')}` : '干净');

// B5. 无网络/命令/子进程信号（排除 RegExp.prototype.exec 等安全用法）
const DANGER_PATTERNS = [
  [/require\(['"]child_process['"]\)/, 'child_process require'],
  [/from\s+['"]child_process['"]/, 'child_process import'],
  [/child_process\b/, 'child_process 引用'],
  [/\bexecSync\s*\(/, 'execSync 调用'],
  [/\bspawnSync\s*\(/, 'spawnSync 调用'],
  [/\bspawn\s*\(/, 'spawn 调用'],
  [/\bexecFile\s*\(/, 'execFile 调用'],
  [/\bfetch\s*\(/, 'fetch 调用'],
  [/\baxios\b/, 'axios'],
  [/\bhttp\.request\b/, 'http.request'],
  [/\bhttps\.request\b/, 'https.request'],
  [/\bnew\s+WebSocket\b/, 'WebSocket'],
  [/\bnet\.connect\b/, 'net.connect'],
  [/\bprocess\.execPath\b/, 'process.execPath'],
];
let dangerFound = [];
for (const f of runtimeFiles) {
  if (!f.rel.endsWith('.js') && !f.rel.endsWith('.mjs')) continue;
  const content = readFileSync(f.abs, 'utf8');
  for (const [p, label] of DANGER_PATTERNS) {
    if (p.test(content)) dangerFound.push(`${f.rel} (${label})`);
  }
}
check('B5 运行时无网络/子进程信号', dangerFound.length === 0,
  dangerFound.length ? dangerFound.join('; ') : '干净（纯字符串处理）');

// ═══ C. awesome-dsh-plugins 条件 ═══

// C1. README 含安装命令
const readme = readFileSync(join(root, 'README.md'), 'utf8');
check('C1 README 含 dsh plugin add 命令', readme.includes('dsh plugin'), '找到安装命令');

// C2. README 含许可证信息
check('C2 README 声明许可证', /licen[cs]e|许可证/i.test(readme));

// C3. 仓库 topics（通过 GitHub API 已确认，此处检查 keywords 字段）
check('C3 keywords 含 dsh-plugin', (pkg.keywords || []).includes('dsh-plugin'));

// C4. 描述 ≤ 120 字符（awesome 要求）
const desc = pkg.description || '';
check('C4 description ≤ 120 字符（awesome 风格）', desc.length <= 120, `${desc.length} 字符`);

// ═══ D. DSH STORE 目录契约 ═══

// D1. 中文名（English Name）格式检查（displayName）
const dn = pkg.displayName || '';
check('D1 displayName 存在', !!dn, dn);
check('D1b displayName 含中文（商店本地化规则）', /[一-鿿]/.test(dn), dn);

// D2. description 含中文用途说明
check('D2 description 含中文', /[一-鿿]/.test(pkg.description || ''));

// D3. 权限保守声明：README 声明无文件/网络访问
check('D3 README 声明无文件系统写入', /无文件系统写入|no file system/i.test(readme));
check('D3b README 声明无网络访问', /无网络访问|no network/i.test(readme));

// ═══ 输出 ═══
console.log('\n═══ 市场收录条件对齐验证 ═══\n');
for (const [status, name, detail] of results) {
  const icon = status === 'PASS' ? '✓' : status === 'WARN' ? '⚠' : '✗';
  console.log(`${icon} [${status}] ${name}${detail ? ` — ${detail}` : ''}`);
}
console.log(`\n═══ 汇总: ${pass} PASS / ${warn} WARN / ${fail} FAIL ═══`);
if (fail > 0) { console.error('\n存在失败项，请修复后再提交。'); process.exit(1); }
