// Opponent evidence: how much of the state record repeats text that is already in the page HTML.
// Usage: node dedupe-state.mjs <dist/client dir>
import { readFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const dist = process.argv[2];
const gz = (t) => gzipSync(t, { level: 9 }).length;
const br = (t) => brotliCompressSync(t, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
for (const page of ['docs/context', 'ui/dialog']) {
  const b = readFileSync(`${dist}/${page}/index.html`, 'utf8');
  const at = b.indexOf('<script b-state');
  const html = b.slice(0, at);
  let stripped = b;
  let repeated = 0;
  for (const match of b.slice(at).matchAll(/"(?:[^"\\]|\\.){400,}"/g)) {
    const text = match[0].slice(1, -1).replaceAll('\\x3C', '<').replaceAll('\\"', '"').replaceAll('\\n', '\n');
    if (html.includes(text.slice(200, 260))) {
      repeated += match[0].length;
      stripped = stripped.replace(match[0], '""');
    }
  }
  console.log(JSON.stringify({ page, rawBytes: b.length, repeatedStateBytes: repeated, gz: gz(b), gzWithoutRepeat: gz(stripped), br: br(b), brWithoutRepeat: br(stripped) }));
}
