// Raw, gzip (level 9) and brotli (quality 11) bytes of the same page in two builds.
//
//   node bytes.mjs BASE_DIST PROTO_DIST /docs/context/ /ui/dialog/ ...
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const [base, proto, ...pages] = process.argv.slice(2);

function sizes(file) {
  const text = readFileSync(file);
  return {
    raw: text.length,
    gzip: gzipSync(text, { level: 9 }).length,
    brotli: brotliCompressSync(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  };
}

for (const page of pages) {
  const before = sizes(path.join(base, 'client', page, 'index.html'));
  const after = sizes(path.join(proto, 'client', page, 'index.html'));
  const parts = [];
  for (const kind of ['raw', 'gzip', 'brotli']) {
    const change = (100 * (after[kind] - before[kind])) / before[kind];
    parts.push(`${kind} ${before[kind]} -> ${after[kind]} (${change.toFixed(1)}%)`);
  }
  console.log(`${page.padEnd(18)} ${parts.join('  ')}`);
}
