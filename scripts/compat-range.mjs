// 宿主兼容范围的最小 semver 判定：只服务本仓库的 engines.dsh 声明校验，不引入依赖。
// 支持 `||` 分支、空格分隔的 `>=` / `>` / `<=` / `<` / `=` 比较器和精确版本；
// 按宿主 dsh-app-boot 的语义使用 includePrerelease（预发布版本参与比较，不做排除）。
// 不支持 `^`、`~`、连字符范围等写法；遇到时抛出明确错误，避免静默误判。

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const COMPARATOR_RE = /^(>=|<=|>|<|=)?(.+)$/u;

function parseVersion(value) {
  if (typeof value !== 'string') throw new TypeError(`版本必须是字符串: ${String(value)}`);
  const match = VERSION_RE.exec(value.trim());
  if (!match) throw new Error(`不是受支持的 semver 版本: ${value}`);
  return {
    major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]),
    prerelease: match[4] === undefined ? [] : match[4].split('.')
  };
}

function comparePrerelease(a, b) {
  // 无预发布后缀的版本高于任何同主版本号的预发布版本。
  if (a.length === 0 && b.length > 0) return 1;
  if (b.length === 0 && a.length > 0) return -1;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    if (x === y) continue;
    const xNumeric = /^\d+$/u.test(x), yNumeric = /^\d+$/u.test(y);
    if (xNumeric && yNumeric) return Number(x) < Number(y) ? -1 : 1;
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return a.length === b.length ? 0 : (a.length < b.length ? -1 : 1);
}

export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  for (const key of ['major', 'minor', 'patch']) {
    if (x[key] !== y[key]) return x[key] < y[key] ? -1 : 1;
  }
  return comparePrerelease(x.prerelease, y.prerelease);
}

export function satisfiesRange(version, range) {
  parseVersion(version);
  if (typeof range !== 'string' || range.trim() === '') return false;
  const alternatives = range.split('||').map((part) => part.trim());
  if (alternatives.some((part) => part === '')) throw new Error(`范围内含空的 || 分支: ${range}`);
  return alternatives.some((alternative) => alternative.split(/\s+/u).every((token) => {
    const match = COMPARATOR_RE.exec(token);
    if (!match || match[2].startsWith('^') || match[2].startsWith('~')) {
      throw new Error(`不支持的比较器“${token}”；请改用 >= / <= / > / < / 精确版本`);
    }
    const operator = match[1] ?? '=';
    const order = compareVersions(version, match[2]);
    return operator === '>=' ? order >= 0
      : operator === '<=' ? order <= 0
      : operator === '>' ? order > 0
      : operator === '<' ? order < 0
      : order === 0;
  }));
}
