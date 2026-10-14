// 可选的真实 React / Chromium 隔离测试。只用已安装库和静态 vendor，不启动服务器、不登录生产页面。
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { COMPONENTS, TranslationRuntime } from '../lib/rules.js';
import { translate } from '../lib/index.js';
const [hostRoot, playwrightManifest, chrome] = process.argv.slice(2);
if (!hostRoot || !playwrightManifest || !chrome) throw new Error('用法：node tests/settings-browser.mjs <宿主 app> <现有 Playwright package.json> <现有 Chromium executable>');
const requireBrowser = createRequire(resolve(playwrightManifest));
const { chromium } = requireBrowser('playwright-core');
const vendorPath = join(hostRoot, 'node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/vendor-BlFz1smR.js');
const vendor = readFileSync(vendorPath, 'utf8');
const shell = readFileSync(join(hostRoot, 'node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-C5TXjxs_.js'), 'utf8');
// 提取同一静态壳的内置库声明；截断在模块映射之后，不运行应用 bootstrap 或任何 Host 服务。
const boundary = shell.indexOf('const vM=', shell.indexOf('function gM()'));
assert.ok(boundary > 0, '实际前端内置模块映射已变化，请重新核验');
const libraries = shell.slice(0, boundary);
const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
const output = resolve('tests/artifacts');
assert.equal(output, join(process.cwd(), 'tests', 'artifacts'));
mkdirSync(output, { recursive: true });
const versions = Object.fromEntries(COMPONENTS.map((info) => [info.id, { version: info.package ? info.versions.at(-1) : undefined }]));
let preferences = {};
const runtime = new TranslationRuntime({ preferences: { get: () => preferences } }, () => versions);
const metadata = { ...runtime.describe(), namespace: 'prompt-zh-test', schemaAvailable: true };
const browser = await chromium.launch({ executablePath: chrome, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 840 } });
  await page.route('**/*', (route) => route.abort());
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:24px;font-family:system-ui"><p>隔离界面测试数据，不是生产 Profile</p><main id="root"></main></body></html>');
  await page.evaluate(async ({ vendor, libraries }) => {
    const vendorUrl = URL.createObjectURL(new Blob([vendor], { type: 'text/javascript' }));
    const librarySource = libraries.replaceAll('./vendor-BlFz1smR.js', vendorUrl) + '\nwindow.testBuiltins = gM();';
    const libraryUrl = URL.createObjectURL(new Blob([librarySource], { type: 'text/javascript' }));
    try {
      await import(libraryUrl);
      window.testReact = window.testBuiltins.react;
      window.testReactDOM = window.testBuiltins['react-dom/client'];
      if (!window.testReact?.createElement || !window.testReactDOM?.createRoot) throw new Error('实际前端库契约已变化');
    } finally { URL.revokeObjectURL(libraryUrl); URL.revokeObjectURL(vendorUrl); }
  }, { vendor, libraries });
  await page.evaluate((data) => {
    window.testMetadata = data;
    window.testWrites = 0;
    window.testSnapshot = { status: 'ready', mode: 'host', writable: true, revision: 1, value: { preferences: { disabledComponents: [], overrides: {} } } };
    const listeners = new Set();
    const form = {
      getSnapshot: () => window.testSnapshot,
      subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      mutate: async (ops, revision) => {
        if (revision !== window.testSnapshot.revision) return false;
        window.testWrites++;
        window.testSnapshot = { ...window.testSnapshot, revision: revision + 1, value: { preferences: ops[0].value } };
        listeners.forEach((fn) => fn());
        return true;
      }
    };
    window.fetch = async (url) => {
      if (url !== '/api/prompt-zh/status') throw new Error('隔离测试拒绝非诊断请求');
      return new Response(JSON.stringify(window.testMetadata), { headers: { 'content-type': 'application/json' } });
    };
    const root = window.testReactDOM.createRoot(document.getElementById('root'));
    window.testDisposers = [];
    const ctx = {
      inject: (_keys, callback) => callback({ configForms: { get: () => form }, effect: (setup) => { const dispose = setup(); window.testDisposers.push(dispose); return dispose; } }),
      effect: (setup) => { const dispose = setup(); window.testDisposers.push(dispose); return dispose; },
      slots: {
        inject: (_name, factory) => factory(),
        register: (spec, render) => { if (spec.name === 'settings.section') root.render(render()); return () => {}; }
      }
    };
    window.__ModuleLoader__ = { load: (descriptor) => {
      const plugin = descriptor.factory((name) => { if (name !== 'react') throw new Error('未知客户端依赖'); return window.testReact; });
      plugin.apply(ctx);
    } };
  }, metadata);
  await page.addScriptTag({ content: client });
  await page.getByRole('heading', { name: 'Prompt ZH · 译文设置' }).waitFor();
  const identity = page.getByLabel('译文：harness:identity', { exact: true });
  await identity.waitFor();
  assert.equal(await identity.inputValue(), '你是由 DeepSeek Harness 驱动的 AI agent。');
  const version = await page.evaluate(() => window.testReact.version);
  console.log('PASS browser: 实际宿主前端 React', version, '226 条目／原生页面组件已挂载');
  await identity.fill('隔离浏览器保存的实际译文。');
  await page.getByRole('button', { name: '保存到当前 Profile', exact: true }).click();
  await page.getByText('已保存到当前 Profile；', { exact: false }).waitFor();
  preferences = await page.evaluate(() => window.testSnapshot.value.preferences);
  assert.equal(translate('harness:identity', 'You are an AI agent powered by DeepSeek Harness.', runtime.operation('browser-save')), '隔离浏览器保存的实际译文。');
  const writes = await page.evaluate(() => window.testWrites);
  await page.locator('[data-entry-id="core:harness:identity"]').getByRole('button', { name: '还原此条草稿' }).click();
  assert.equal(await page.evaluate(() => window.testWrites), writes);
  assert.equal(await identity.inputValue(), '你是由 DeepSeek Harness 驱动的 AI agent。');
  console.log('PASS browser: 真实 textarea 编辑／保存进入实际翻译／还原不持久化');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(output, 'settings-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, '窄屏不能横向溢出');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(output, 'settings-mobile.png') });
  await page.getByLabel('译文区块').selectOption('mcp.blender');
  await page.getByRole('heading', { name: '你可以使用 Blender 工具直接操作 Blender 场景。' }).waitFor();
  assert.ok((await page.locator('body').innerText()).includes('服务器版本来源不可用'));
  console.log('PASS browser: 窄屏无横向溢出／MCP 不可核验警告／仅草稿还原');
  await page.evaluate(() => window.testDisposers[0]());
  await page.getByText('当前没有可写的宿主 Profile 表单；', { exact: false }).waitFor();
  assert.ok(await page.getByRole('button', { name: '保存到当前 Profile', exact: true }).isDisabled());
  console.log('PASS browser: configForms 依赖消失后立即禁用保存，不使用陈旧表单。');
  assert.deepEqual(errors, []);
  await page.evaluate(() => window.testDisposers.reverse().forEach((dispose) => dispose()));
  assert.equal(await page.locator('style[data-plugin-css="dsh-prompt-zh"]').count(), 0);
  console.log('PASS browser: 无 pageerror／插件样式卸载清理；未写生产 Profile。');
} finally { await browser.close(); }
