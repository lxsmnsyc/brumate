// client-audit: minified bytes of each source module in a built chunk, from its source map.
// Usage: node test/audit/attribute.mjs <chunk.js> (with <chunk.js>.map next to it)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../../node_modules/.pnpm/@jridgewell+trace-mapping@0.3.31/node_modules/', import.meta.url));
const { TraceMap, originalPositionFor } = require('@jridgewell/trace-mapping');
const file = process.argv[2];
const code = readFileSync(file, 'utf8');
const map = new TraceMap(JSON.parse(readFileSync(`${file}.map`, 'utf8')));
const bytes = new Map();
// A source in a built package with its own map (dist/*.js.map) is traced once more.
const inner = new Map();
const byLine = new Map();
let lastLine = 0;
function trace(position) {
  const source = new URL(position.source, new URL(file, 'file:///'.concat(process.cwd(), '/'))).pathname;
  if (!inner.has(source)) {
    try {
      inner.set(source, new TraceMap(JSON.parse(readFileSync(`${source}.map`, 'utf8'))));
    } catch {
      inner.set(source, undefined);
    }
  }
  const map = inner.get(source);
  if (!map || position.line == null) return position.source;
  const deeper = originalPositionFor(map, { line: position.line, column: position.column });
  if (deeper.source) lastLine = deeper.line;
  return deeper.source ?? position.source;
}
const lines = code.split('\n');
for (const [index, line] of lines.entries()) {
  let last = 'unmapped';
  for (let column = 0; column < line.length; column++) {
    const position = originalPositionFor(map, { line: index + 1, column });
    if (position.source) last = trace(position).replace(/^.*src\/runtime\//, '').replace(/^.*\//, (m) => m);
    bytes.set(last, (bytes.get(last) ?? 0) + 1);
    const key = `${last}:${lastLine}`;
    byLine.set(key, (byLine.get(key) ?? 0) + 1);
  }
}
const total = code.length;
for (const [source, count] of [...bytes].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(6)} ${(100 * count / total).toFixed(1).padStart(5)}% ${source}`);
}
console.log(`${total} total`);
// --functions: bytes by top-level function of each runtime module.
if (process.argv.includes('--functions')) {
  const src = new URL('../../src/runtime/', import.meta.url).pathname;
  const fns = new Map();
  const starts = new Map();
  for (const [key, count] of byLine) {
    const [source, line] = key.split(':');
    if (!starts.has(source)) {
      try {
        const text = readFileSync(src + source, 'utf8').split('\n');
        const list = [];
        for (const [index, row] of text.entries()) {
          const match = /^(?:export )?(?:async )?(?:function\*? |const |let |class )(\w+)/.exec(row);
          if (match) list.push([index + 1, match[1]]);
        }
        starts.set(source, list);
      } catch {
        starts.set(source, []);
      }
    }
    let name = '(top)';
    for (const [start, fn] of starts.get(source)) {
      if (start <= Number(line)) name = fn;
    }
    const id = `${source} ${name}`;
    fns.set(id, (fns.get(id) ?? 0) + count);
  }
  for (const [id, count] of [...fns].sort((a, b) => b[1] - a[1])) console.log(`${String(count).padStart(6)} ${id}`);
}
