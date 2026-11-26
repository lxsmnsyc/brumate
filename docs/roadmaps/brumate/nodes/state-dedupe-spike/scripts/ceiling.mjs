// The ceiling of the saving: the page with every state string of MIN+ chars that its markup prints
// replaced by an empty string, in raw, gzip (level 9) and brotli (quality 11) bytes.
//
//   node ceiling.mjs FILE.html [--min 64]
import { readFileSync } from 'node:fs';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { min: { type: 'string', default: '64' } },
});
const html = readFileSync(positionals[0], 'utf8');
const min = Number(values.min);
const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
const markup = html.replace(scriptPattern, '');

function escapeText(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
function decode(body) {
  return JSON.parse(
    `"${body.replaceAll(/\\x([0-9a-fA-F]{2})/g, '\\u00$1').replaceAll("\\'", "'")}"`,
  );
}
const literal = /"((?:[^"\\]|\\.)*)"/g;
const blanked = html.replace(scriptPattern, (whole, attributes, code) => {
  if (!attributes.includes('b-state')) {
    return whole;
  }
  const next = code.replace(literal, (match, body) => {
    const value = decode(body);
    if (value.length < min) {
      return match;
    }
    return markup.includes(value) || markup.includes(escapeText(value)) ? '""' : match;
  });
  return whole.replace(code, () => next);
});

function sizes(text) {
  return {
    raw: Buffer.byteLength(text),
    gzip: gzipSync(text, { level: 9 }).length,
    brotli: brotliCompressSync(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  };
}
const before = sizes(html);
const after = sizes(blanked);
for (const kind of ['raw', 'gzip', 'brotli']) {
  const saved = before[kind] - after[kind];
  console.log(
    `${kind.padEnd(6)} ${before[kind]} -> ${after[kind]}  saved ${saved} (${((100 * saved) / before[kind]).toFixed(1)}%)`,
  );
}
