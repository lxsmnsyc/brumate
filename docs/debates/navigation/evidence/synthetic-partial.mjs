// Opponent evidence: builds a synthetic partial response from two prerendered pages and compares sizes.
// Usage: node synthetic-partial.mjs <dist/client dir>
import { readFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const dist = process.argv[2];
const pairs = [['docs/styles', 'docs/context'], ['ui/button', 'ui/dialog']];
const pattern = /<(?:link|meta|script|style|title)\b[\s\S]*?(?:<\/(?:script|style|title)>|>)/g;

function gz(text) {
  return gzipSync(text, { level: 9 }).length;
}
function br(text) {
  return brotliCompressSync(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
}

for (const [from, to] of pairs) {
  const a = readFileSync(`${dist}/${from}/index.html`, 'utf8');
  const b = readFileSync(`${dist}/${to}/index.html`, 'utf8');
  const state = b.match(/<script b-state[^>]*>[\s\S]*?<\/script>/)[0];
  // The page route region: second region comment to the first close after it.
  const starts = [...b.matchAll(/<!--R\d+:children:/g)].map((m) => m.index);
  const end = [...b.matchAll(/<!--\/R-->/g)].map((m) => m.index + 8).find((e) => e > starts[1]);
  const region = b.slice(starts[1], end);
  // Head entries of the new page that the old page does not have.
  const head = (t) => t.match(/<head[\s\S]*?<\/head>/)[0];
  const old = new Set(head(a).match(pattern));
  const fresh = head(b).match(pattern).filter((t) => !old.has(t)).join('');
  // Upper bound on the state saved: the layout entries before the first route entry.
  const tagEnd = state.indexOf('>') + 1;
  const body = state.slice(tagEnd);
  const cut = body.search(/[{,]"?1[1-9]\.?\d*"?:\{k:/);
  const partialFull = fresh + region + state;
  const partialTrim = fresh + region + state.slice(0, tagEnd) + body.slice(Math.max(cut, 0));
  for (const [label, partial] of [['all state', partialFull], ['layout entries dropped', partialTrim]]) {
    console.log(JSON.stringify({
      to, label,
      fullRaw: b.length, partialRaw: partial.length,
      fullGz: gz(b), partialGz: gz(partial), savedGz: +(1 - gz(partial) / gz(b)).toFixed(3),
      fullBr: br(b), partialBr: br(partial), savedBr: +(1 - br(partial) / br(b)).toFixed(3),
      freshHeadRaw: fresh.length, freshHeadGz: gz(fresh), stateGz: gz(state), regionGz: gz(region),
    }));
  }
}
