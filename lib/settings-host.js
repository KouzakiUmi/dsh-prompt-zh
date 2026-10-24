import { COMPONENTS, getRules } from './rules.js';

function validateOverrides(value, specification) {
  for (const [id, text] of Object.entries(value)) {
    if (!Object.hasOwn(specification, id)) throw new TypeError('译文覆盖包含未知条目');
    if (typeof text !== 'string' || !text.trim()) throw new TypeError('译文不能为空');
    const required = specification[id];
    const tokens = [...text.matchAll(/\$(\$|&|[1-9]\d?)/gu)].filter((match) => /^[1-9]/u.test(match[1])).map((match) => match[0]);
    if (required.some((token) => !tokens.includes(token))) throw new TypeError('必须保留动态占位符');
    if (tokens.some((token) => !required.includes(token))) throw new TypeError('包含未知动态占位符');
  }
  return value;
}

export function createConfigSchema(z) {
  if (typeof z?.object !== 'function' || typeof z.string().volatile !== 'function') return undefined;
  const rules = getRules();
  const specification = Object.fromEntries(rules.map((rule) => [rule.id, rule.placeholders]));
  const validate = (value) => validateOverrides(value, specification);
  // Schemastery 原生回调序列化：只嵌入内置 ID/占位符，不嵌入用户译文或宿主闭包。
  // Host 用同一验证函数；JSON 重建后的客户端获得自包含验证器。
  validate.toJSON = () => `(value) => (${validateOverrides.toString()})(value, ${JSON.stringify(specification)})`;
  const overrides = z.transform(z.dict(z.string()), validate).default({});
  const preferences = z.object({
    disabledComponents: z.array(z.union(COMPONENTS.map((item) => z.const(item.id)))).default([]), overrides
  }).default({ disabledComponents: [], overrides: {} });
  return z.object({ preferences: preferences.volatile() });
}

// 在全部内置条目登记后构造 schema；普通 Node 下仍可单独使用纯翻译导出。
export async function loadConfigSchema() {
  try {
    const module = await import('@deepseek-ai/schemastery');
    return createConfigSchema(module.default ?? module.z ?? module);
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' && error.code !== 'MODULE_NOT_FOUND') throw error;
    return undefined;
  }
}

// 版本只读宿主已解析的 packageOf 记录（name/version 由宿主从 manifest 带出），
// 插件自身不打开任何文件——不可解析即 unavailable，不区分权限拒绝与未安装。
export function versionResolver(ctx, resolvePackage = (name) => ctx.get('pluginPackages')?.packageOf(name, import.meta.url)) {
  return () => {
    const versions = {};
    const cache = new Map();
    for (const component of COMPONENTS) {
      const name = component.package;
      if (!name) { versions[component.id] = { status: 'unavailable' }; continue; }
      if (!cache.has(name)) {
        let result = { status: 'unavailable' };
        try {
          const pkg = resolvePackage(name);
          if (pkg?.name === name && typeof pkg.version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(pkg.version)) {
            result = { status: 'resolved', version: pkg.version };
          }
        } catch {
          // 解析失败只代表不可核验；不把权限拒绝写成“未安装”，也不泄漏路径/异常原文。
          result = { status: 'unavailable' };
        }
        cache.set(name, result);
      }
      versions[component.id] = cache.get(name);
    }
    return versions;
  };
}

export const STATUS_PATH = '/api/prompt-zh/status';
export function installSettingsHost(ctx, runtime) {
  ctx.inject(['settings'], (scope) => {
    if (typeof scope.settings.configure !== 'function') return;
    scope.effect(() => scope.settings.configure({ auto: false }, ctx.fiber), 'prompt-zh: native settings presentation');
  });
  ctx.inject(['connection'], (scope) => {
    // 使用 Connection 的 Host/Origin 和浏览器认证，不自建无认证的 webServer 写接口。
    if (typeof scope.connection.fetch?.register !== 'function') return;
    scope.effect(() => scope.connection.fetch.register({
      path: STATUS_PATH, methods: ['GET'], requestBody: 'buffered',
      fetch: () => {
        const editor = ctx.get('configEditor');
        const entry = typeof editor?.entries === 'function' ? editor.entries().find((row) => row.fiber === ctx.fiber) : undefined;
        return new Response(JSON.stringify({
          ...runtime.describe(), namespace: entry?.options.id ?? 'prompt-zh', schemaAvailable: Boolean(ctx.fiber?.runtime?.Config?.toJSON)
        }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
      }
    }), 'prompt-zh: authenticated status route');
  });
}
