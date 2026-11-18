// Proponent evidence (round 2): partial response after the state dedupe, against today's full page and the deduped full page.
// Usage: node combined-partial.mjs <dist/client dir>
import { readFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const dist = process.argv[2];
const gz = (t) => gzipSync(t, { level: 9 }).length;
const br = (t) => brotliCompressSync(t, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const pairs = [['docs/styles', 'docs/context'], ['ui/button', 'ui/dialog']];
const pattern = /<(?:link|meta|script|style|title)\b[\s\S]*?(?:<\/(?:script|style|title)>|>)/g;
const head = (t) => t.match(/<head[\s\S]*?<\/head>/)[0];

// Empty every long state string whose text is already in the html before the record.
function dedupe(html, state) {
  let out = state;
  for (const m of state.matchAll(/"(?:[^"\\]|\\.){400,}"/g)) {
    const text = m[0].slice(1, -1).replaceAll('\\x3C', '<').replaceAll('\\"', '"').replaceAll('\\n', '\n');
    if (html.includes(text.slice(200, 260))) out = out.replace(m[0], '""');
  }
  return out;
}

for (const [from, to] of pairs) {
  const a = readFileSync(`${dist}/${from}/index.html`, 'utf8');
  const b = readFileSync(`${dist}/${to}/index.html`, 'utf8');
  const at = b.indexOf('<script b-state');
  const state = b.match(/<script b-state[^>]*>[\s\S]*?<\/script>/)[0];
  const starts = [...b.matchAll(/<!--R\d+:children:/g)].map((m) => m.index);
  const end = [...b.matchAll(/<!--\/R-->/g)].map((m) => m.index + 8).find((e) => e > starts[1]);
  const region = b.slice(starts[1], end);
  const old = new Set(head(a).match(pattern));
  const fresh = head(b).match(pattern).filter((t) => !old.has(t)).join('');
  const tagEnd = state.indexOf('>') + 1;
  const body = state.slice(tagEnd);
  const cut = body.search(/[{,]"?1[1-9]\.?\d*"?:\{k:/);
  const trimmed = state.slice(0, tagEnd) + body.slice(Math.max(cut, 0));
  const fullDedup = b.slice(0, at) + dedupe(b.slice(0, at), b.slice(at));
  const partial = fresh + region + trimmed;
  const partialDedup = fresh + region + dedupe(region, trimmed);
  const row = (label, t) => ({ label, raw: t.length, gz: gz(t), br: br(t) });
  console.log(JSON.stringify({
    to,
    full: row('full', b), fullDeduped: row('fullDeduped', fullDedup),
    partial: row('partial', partial), partialDeduped: row('partialDeduped', partialDedup),
    partialDedupedVsFull: +(1 - gz(partialDedup) / gz(b)).toFixed(3),
    partialDedupedVsFullDeduped: +(1 - gz(partialDedup) / gz(fullDedup)).toFixed(3),
    dedupeAloneVsFull: +(1 - gz(fullDedup) / gz(b)).toFixed(3),
  }));
}
