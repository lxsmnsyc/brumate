// Lists the long strings of the state records of a built page, and whether the page's markup
// (outside its scripts) already prints each one, as text or as raw HTML.
//
//   node strings.mjs FILE.html [--min 64] [--top 20]
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { min: { type: 'string', default: '64' }, top: { type: 'string', default: '20' } },
});
const html = readFileSync(positionals[0], 'utf8');
const min = Number(values.min);

// The state records, and the markup with every script taken out.
const states = [];
const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
for (const match of html.matchAll(scriptPattern)) {
  if (match[1].includes('b-state')) {
    states.push(match[2]);
  }
}
const markup = html.replace(scriptPattern, '');

/** The text of a string as the markup prints it in a text node. */
function escapeText(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const literal = /"((?:[^"\\]|\\.)*)"/g;
const found = [];
let stateBytes = 0;
for (const code of states) {
  stateBytes += Buffer.byteLength(code);
  for (const match of code.matchAll(literal)) {
    // seroval writes JS string literals; eval of a literal is safe here, the input is our own build.
    const value = JSON.parse(
      `"${match[1].replaceAll(/\\x([0-9a-fA-F]{2})/g, '\\u00$1').replaceAll("\\'", "'")}"`,
    );
    if (value.length < min) {
      continue;
    }
    let printed = 'no';
    if (markup.includes(value)) {
      printed = 'raw';
    } else if (markup.includes(escapeText(value))) {
      printed = 'text';
    }
    found.push({ bytes: Buffer.byteLength(match[0]), printed, head: value.slice(0, 60) });
  }
}

let total = 0;
const byKind = { raw: 0, text: 0, no: 0 };
for (const item of found) {
  total += item.bytes;
  byKind[item.printed] += item.bytes;
}
console.log(`page ${Buffer.byteLength(html)} B, gzip ${gzipSync(html, { level: 9 }).length} B`);
console.log(`state ${stateBytes} B in ${states.length} records`);
console.log(`strings of ${min}+ chars: ${found.length}, ${total} B of code`);
console.log(`  printed raw ${byKind.raw} B, as text ${byKind.text} B, not printed ${byKind.no} B`);
found.sort((a, b) => b.bytes - a.bytes);
for (const item of found.slice(0, Number(values.top))) {
  console.log(
    `  ${String(item.bytes).padStart(7)} ${item.printed.padEnd(4)} ${JSON.stringify(item.head)}`,
  );
}
