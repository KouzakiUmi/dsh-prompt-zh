// 有界迁移：把当前核心策略中的静态中文片段接入真实译文条目，不触碰其他文件。
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const target = path.resolve('lib/index.js');
assert.equal(path.dirname(target), path.join(process.cwd(), 'lib'));
const source = fs.readFileSync(target, 'utf8');
const start = source.indexOf('function networkPolicy(');
const end = source.indexOf('function translateContext(');
assert.ok(start >= 0 && end > start);
let part = source.slice(start, end);
assert.ok(!part.includes("generatedText('network."), '迁移已经执行');
let count = 0;
part = part.replace(/'(?:\\.|[^'\\])*'/gu, (literal, offset) => {
  if (!/[\u3400-\u9fff]/u.test(literal)) return literal;
  const previous = part.slice(0, offset);
  const scope = previous.lastIndexOf('function delegationPolicy(') >= 0 ? 'delegation' : previous.lastIndexOf('function filePolicy(') >= 0 ? 'files' : 'network';
  const key = `${scope}.${createHash('sha256').update(literal).digest('hex').slice(0, 16)}`;
  count++;
  return `generatedText('${key}', ${literal}, runtime)`;
});
part = part.replace('function filePolicy(tools) {', "function filePolicy(tools, runtime) {\n  if (!componentEnabled(runtime, 'core')) return '';")
  .replace('function delegationPolicy(sections, tools) {', "function delegationPolicy(sections, tools, runtime) {\n  if (!componentEnabled(runtime, 'core')) return '';");
assert.ok(count > 10);
console.log(`Verified target: ${target}; ${count} policy fragments`);
fs.writeFileSync(target, source.slice(0, start) + part + source.slice(end), 'utf8');
