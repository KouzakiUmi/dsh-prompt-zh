// 内置译文的唯一运行时登记点。注册只保存静态规则，不保存任何实际提示词或捕获值。
export const COMPONENTS = Object.freeze([
  { id: 'core', label: '核心系统段落', package: '@deepseek-ai/dsh-system-prompt', versions: ['0.2.1-alpha.2', '0.2.1-alpha.3', '0.2.1-rc.2', '0.2.1-rc.3', '0.2.1-rc.4', '0.2.1-rc.5'], thirdParty: false },
  { id: 'workspace', label: '核心 · 工作区指令', package: '@deepseek-ai/dsh-agent-instructions', versions: ['0.2.1-alpha.2', '0.2.1-alpha.3', '0.2.1-rc.2', '0.2.1-rc.3', '0.2.1-rc.4', '0.2.1-rc.5'], thirdParty: false },
  { id: 'skills', label: '核心 · 技能目录', package: '@deepseek-ai/dsh-tool-skill', versions: ['0.2.1-alpha.2', '0.2.1-alpha.3', '0.2.1-rc.2', '0.2.1-rc.3', '0.2.1-rc.4', '0.2.1-rc.5'], thirdParty: false },
  { id: 'time', label: '核心 · 时间与时区', package: '@deepseek-ai/dsh-time-context', versions: ['0.2.1-alpha.2', '0.2.1-alpha.3', '0.2.1-rc.2', '0.2.1-rc.3', '0.2.1-rc.4', '0.2.1-rc.5'], thirdParty: false },
  { id: 'context', label: '核心 · 运行时上下文', package: '@deepseek-ai/dsh-system-prompt', versions: ['0.2.1-alpha.2', '0.2.1-alpha.3', '0.2.1-rc.2', '0.2.1-rc.3', '0.2.1-rc.4', '0.2.1-rc.5'], thirdParty: false, coverage: 'refresh-overwritten' },
  { id: 'hindsight', label: 'Hindsight 记忆包装', package: '@vectorize-io/hindsight-coding-agents', versions: ['0.8.1', '0.8.2'], thirdParty: true },
  { id: 'gitbash', label: 'Git Bash 附加指导', package: 'dsh-gitbash-shell', versions: ['0.39.0', '0.39.4', '0.42.2', '0.43.2'], thirdParty: true },
  ...['blender', 'context7', 'github', 'playwright', 'chrome-devtools'].map((name) => ({
    id: `mcp.${name}`, label: `MCP · ${name}`,
    package: null, versions: [], thirdParty: true,
    coverage: 'server-version-unavailable', translateWithoutVersion: true
  })),
  { id: 'mcp.other', label: '其他 MCP 标题', package: null, versions: [], thirdParty: true, coverage: 'server-version-unavailable' }
]);
const components = new Map(COMPONENTS.map((item) => [item.id, item]));
const entries = new Map();

// 稳定标识按原文/匹配规则生成；内置译文调整不把用户覆盖值移到另一条原文上。
function digest(text) {
  let value = 14695981039346656037n;
  for (const character of text) value = BigInt.asUintN(64, (value ^ BigInt(character.codePointAt(0))) * 1099511628211n);
  return value.toString(16).padStart(16, '0');
}
export function defineRule(component, source, defaultText, options = {}) {
  if (!components.has(component)) throw new Error(`Unknown translation component: ${component}`);
  if (typeof defaultText !== 'string') throw new TypeError('Translation defaults must be strings');
  const pattern = source instanceof RegExp ? `/${source.source}/${source.flags}` : String(source);
  const id = options.id ?? `${component}:${digest(pattern)}`;
  const existing = entries.get(id);
  if (existing) {
    if (existing.defaultText !== defaultText || existing.source !== pattern) throw new Error(`Conflicting translation id: ${id}`);
    return existing;
  }
  const rule = Object.freeze({
    id, component, source: pattern, defaultText,
    title: options.title ?? defaultText.split('\n').find((line) => line.trim())?.slice(0, 64) ?? id,
    matchMode: options.matchMode ?? (source instanceof RegExp ? 'pattern' : 'literal'),
    placeholders: Object.freeze([...new Set([...defaultText.matchAll(/\$([1-9]\d?)/gu)].map((match) => match[0]))]),
    coverage: options.coverage ?? components.get(component).coverage ?? 'plugin-stage',
    versions: Object.freeze(options.versions ?? components.get(component).versions),
    prefixNewline: options.prefixNewline === true
  });
  entries.set(id, rule);
  return rule;
}
export function getRules() { return [...entries.values()]; }
export function getRule(id) { return entries.get(id); }

export function formatTranslation(template, captures = [], match = '') {
  return template.replace(/\$(\$|&|[1-9]\d?)/gu, (token, key) => {
    if (key === '$') return '$';
    if (key === '&') return match;
    const value = captures[Number(key) - 1];
    return value === undefined ? token : String(value);
  });
}
export function renderRule(rule, captures = [], runtime, input = '') {
  return runtime ? runtime.render(rule, captures, input) : formatTranslation(rule.defaultText, captures, input);
}
export function replacement(component, source, defaultText, runtime, options) {
  const rule = defineRule(component, source, defaultText, options);
  return (match, ...args) => {
    const named = args.at(-1) !== null && typeof args.at(-1) === 'object';
    const captures = args.slice(0, named ? -3 : -2);
    const value = renderRule(rule, captures, runtime, match);
    return rule.prefixNewline && match.startsWith('\n') && value !== match ? `\n${value}` : value;
  };
}
export function componentEnabled(runtime, component) {
  return runtime === undefined || runtime.enabled(component);
}

export function normalizePreferences(value = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('设置必须是对象');
  if (Object.keys(value).some((key) => key !== 'disabledComponents' && key !== 'overrides')) throw new TypeError('设置包含不支持的字段');
  const disabled = value.disabledComponents ?? [];
  const overrides = value.overrides ?? {};
  if (!Array.isArray(disabled) || disabled.some((id) => !components.has(id))) throw new TypeError('组件开关包含未知条目');
  if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) throw new TypeError('译文覆盖必须是对象');
  const normalized = {};
  for (const [id, text] of Object.entries(overrides)) {
    const rule = getRule(id);
    if (!rule) throw new TypeError('译文覆盖包含已移除或未知的条目');
    if (typeof text !== 'string' || !text.trim()) throw new TypeError('自定义译文不能为空');
    const tokens = [...text.matchAll(/\$(\$|&|[1-9]\d?)/gu)].filter((match) => /^[1-9]/u.test(match[1])).map((match) => match[0]);
    for (const token of rule.placeholders) if (!tokens.includes(token)) throw new TypeError(`动态占位符 ${token} 必须保留`);
    if (tokens.some((token) => !rule.placeholders.includes(token))) throw new TypeError('译文使用了未知动态占位符');
    if (text !== rule.defaultText) normalized[id] = text;
  }
  return { disabledComponents: [...new Set(disabled)], overrides: normalized };
}

export class TranslationRuntime {
  constructor(config = {}, versions = () => ({})) {
    this.config = config;
    this.versions = versions;
    this.stats = new Map();
    this.generation = 0;
    this.fingerprint = null;
    this.configurationError = false;
  }
  operation(stage, { defaultRuleIds = [] } = {}) {
    const defaults = new Set(defaultRuleIds);
    let preferences;
    try {
      const ref = this.config.preferences;
      const raw = ref && typeof ref.get === 'function' ? ref.get() : ref ?? {};
      preferences = normalizePreferences(raw);
      this.configurationError = false;
    }
    catch { preferences = { disabledComponents: COMPONENTS.map((item) => item.id), overrides: {} }; this.configurationError = true; }
    const versions = this.versions();
    const fingerprint = JSON.stringify([preferences, versions]);
    if (this.fingerprint !== fingerprint) {
      this.fingerprint = fingerprint;
      this.stats.clear();
      this.generation += 1;
    }
    const generation = this.generation;
    const eligible = (component, allowed) => {
      const info = components.get(component);
      if (!info || preferences.disabledComponents.includes(component)) return false;
      // 守卫式组件（MCP 已知 server）每条译文都带原文特征，命中才替换，因此不按版本门控；
      // 未知 MCP 标题仍保持门控，不猜译服务器正文。
      if (info.translateWithoutVersion === true) return true;
      return !info.thirdParty || (allowed ?? info.versions).includes(versions[component]?.version);
    };
    const template = (rule) => defaults.has(rule.id) ? rule.defaultText : preferences.overrides[rule.id] ?? rule.defaultText;
    return {
      versions,
      enabled: (component) => eligible(component),
      template,
      render: (rule, captures, input) => {
        const active = eligible(rule.component, rule.versions);
        const output = active ? formatTranslation(template(rule), captures, input) : input;
        const defaulted = Number(active && defaults.has(rule.id) && Object.hasOwn(preferences.overrides, rule.id));
        if (generation === this.generation) {
          const previous = this.stats.get(rule.id) ?? { matched: 0, replaced: 0, blocked: 0, stages: {} };
          const stageMetrics = previous.stages[stage] ?? { matched: 0, replaced: 0, blocked: 0 };
          const changed = Number(active && output !== input);
          const blocked = Number(!active);
          this.stats.set(rule.id, {
            matched: previous.matched + 1,
            replaced: previous.replaced + changed,
            blocked: previous.blocked + blocked, defaulted: (previous.defaulted ?? 0) + defaulted, stage,
            stages: { ...previous.stages, [stage]: {
              matched: stageMetrics.matched + 1, replaced: stageMetrics.replaced + changed, blocked: stageMetrics.blocked + blocked,
              defaulted: (stageMetrics.defaulted ?? 0) + defaulted
            } }
          });
        }
        return output;
      }
    };
  }
  describe() {
    // 同一份配置快照用于页面版本状态；配置变化后不沿用之前的绿色命中计数。
    const operation = this.operation('status');
    const versions = operation.versions;
    return {
      generation: this.generation, configurationError: this.configurationError,
      components: COMPONENTS.map((item) => ({
        ...item, currentVersion: versions[item.id]?.version ?? null,
        versionStatus: item.versions.includes(versions[item.id]?.version) ? 'exact' : versions[item.id]?.version ? 'mismatch' : 'unavailable',
        enabled: operation.enabled(item.id)
      })),
      entries: getRules().map((rule) => ({
        ...rule,
        active: operation.enabled(rule.component) && (components.get(rule.component).translateWithoutVersion === true
          || !components.get(rule.component).thirdParty || rule.versions.includes(versions[rule.component]?.version)),
        versionStatus: rule.versions.includes(versions[rule.component]?.version) ? 'exact' : versions[rule.component]?.version ? 'mismatch' : 'unavailable',
        metrics: this.stats.get(rule.id) ?? { matched: 0, replaced: 0, blocked: 0, stage: null, stages: {} }
      }))
    };
  }
}
