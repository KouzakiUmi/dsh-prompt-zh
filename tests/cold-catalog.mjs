// 静态 import 时立即执行，必须早于 check.mjs 的任何翻译调用，避免热登记掩盖缺项。
import assert from 'node:assert/strict';
import { getRules, translate } from '../lib/index.js';
import { TranslationRuntime } from '../lib/rules.js';

const before = getRules();
const ids = ['core:computer-use:cua-driver-native', 'core:computer-use:desktop-permissions'];
for (const id of ids) assert.ok(before.some((rule) => rule.id === id), `冷启动缺失规则: ${id}`);
const overrides = Object.fromEntries(ids.map((id, index) => [id, `桌面自定义译文${index}`]));
const runtime = new TranslationRuntime({ preferences: { overrides } });
const output = translate('computer-use:cua-driver-native',
  'Cua Driver is for operating the host desktop. Desktop manages OS permission requests.', runtime.operation('test'));
assert.equal(output, Object.values(overrides).join(' '));
assert.equal(runtime.configurationError, false);
assert.equal(getRules().length, before.length, '首次翻译不应再增加静态目录条目');

export const coldCatalogChecks = [
  { label: 'cold catalog: CUA 两条规则启动即登记，旧覆盖值有效且首次命中不增项', ok: true, missing: [] }
];
