// 本次译文条目化的有界源码迁移；只处理两份已读取的自有模块，不处理宿主或任意文件。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
function skip(text, i) { while (/\s/u.test(text[i] ?? '') && i < text.length) i++; return i; }
function literalEnd(text, i) {
  const quote = text[i];
  if (!['\'', '"', '`', '/'].includes(quote)) return -1;
  let inClass = false;
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') { j++; continue; }
    if (quote === '/') {
      if (text[j] === '[') inClass = true;
      if (text[j] === ']') inClass = false;
    }
    if (text[j] === quote && !inClass) {
      j++;
      if (quote === '/') while (/[a-z]/u.test(text[j] ?? '') && j < text.length) j++;
      return j;
    }
  }
  throw new Error('Unterminated source literal');
}
function callEnd(text, i) {
  let depth = 1;
  while (i < text.length) {
    if (['\'', '"', '`'].includes(text[i])) { i = literalEnd(text, i); continue; }
    if (text[i] === '(') depth++;
    if (text[i] === ')' && --depth === 0) return i;
    i++;
  }
  throw new Error('Unterminated replacement');
}
const outputs = [];
for (const filename of ['lib/injections.js', 'lib/mcp.js']) {
  const absolute = path.resolve(root, filename);
  assert.equal(path.dirname(absolute), path.join(root, 'lib'));
  const original = fs.readFileSync(absolute, 'utf8');
  const regions = filename.endsWith('injections.js')
    ? [...original.matchAll(/function (translateInstructions|translateSkills|translateRuntimeContextHead|translateTimeContext|translateHindsight)\(text\)/gu)].map((m) => ({ pos: m.index, component: ({ translateInstructions:'workspace', translateSkills:'skills', translateRuntimeContextHead:'context', translateTimeContext:'time', translateHindsight:'hindsight' })[m[1]] }))
    : [...original.matchAll(/^\s*(?:'([^']+)'|([\w-]+)):\s*\(text\)\s*=>\s*\{/gmu)].map((m) => ({ pos: m.index, component: `mcp.${m[1] ?? m[2]}` }));
  const edits = [];
  for (const match of original.matchAll(/\.replace\(/gu)) {
    const component = regions.filter((r) => r.pos < match.index).at(-1)?.component;
    if (!component) continue;
    const start = skip(original, match.index + match[0].length);
    const firstEnd = literalEnd(original, start);
    if (firstEnd < 0) continue;
    const comma = skip(original, firstEnd);
    if (original[comma] !== ',') continue;
    const second = skip(original, comma + 1);
    const secondEnd = ['\'', '"', '`'].includes(original[second]) ? literalEnd(original, second) : -1;
    const source = original.slice(start, firstEnd);
    if (secondEnd >= 0) {
      const value = original.slice(second, secondEnd);
      if (!/[\u3400-\u9fff]/u.test(value) || value.includes('${')) continue;
      edits.push({ start: second, end: secondEnd, text: `replacement('${component}', ${source}, ${value}, runtime)` });
    } else {
      const end = callEnd(original, second);
      const callback = original.slice(second, end);
      if (callback.includes('=> {') || !callback.includes("m.startsWith('\\n')")) continue;
      const literals = [];
      for (let at = 0; at < callback.length; at++) if (['\'', '"'].includes(callback[at])) {
        const stop = literalEnd(callback, at); literals.push(callback.slice(at, stop)); at = stop - 1;
      }
      const value = literals.at(-1);
      assert.ok(value && /[\u3400-\u9fff]/u.test(value));
      edits.push({ start: second, end, text: `replacement('${component}', ${source}, ${value}, runtime, { prefixNewline: true })` });
    }
  }
  assert.ok(edits.length > 0, 'Migration already applied or source differs');
  let text = original;
  for (const edit of edits.reverse()) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  text = text.replace("import { translateAllMcp } from './mcp.js';", "import { translateAllMcp } from './mcp.js';\nimport { replacement, componentEnabled } from './rules.js';")
    .replace("import { translateBlender } from './blender.js';", "import { translateBlender } from './blender.js';\nimport { replacement, componentEnabled, defineRule, renderRule } from './rules.js';");
  if (filename.endsWith('injections.js')) {
    for (const region of regions) {
      const name = ({ workspace:'translateInstructions', skills:'translateSkills', context:'translateRuntimeContextHead', time:'translateTimeContext', hindsight:'translateHindsight' })[region.component];
      text = text.replace(`function ${name}(text) {`, `function ${name}(text, runtime) {\n  if (!componentEnabled(runtime, '${region.component}')) return text;`);
    }
  } else {
    text = text.replace(/((?:'[^']+'|[\w-]+): )\(text\) => \{/gu, '$1(text, runtime) => {');
    for (const component of new Set(regions.map((r) => r.component))) {
      const name = component.slice(4);
      const key = name.includes('-') ? `'${name}'` : name;
      text = text.replace(`${key}: (text, runtime) => {`, `${key}: (text, runtime) => {\n    if (!componentEnabled(runtime, '${component}')) return text;`);
    }
  }
  outputs.push({ absolute, filename, text, count: edits.length });
}
for (const output of outputs) {
  console.log(`Verified target: ${output.absolute}; ${output.count} literal rules`);
  fs.writeFileSync(output.absolute, output.text, 'utf8');
}
