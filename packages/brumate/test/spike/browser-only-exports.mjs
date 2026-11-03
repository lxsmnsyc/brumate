// values-spike: counts the exports of `brumate/client` that compiled code calls only from browser
// render code. Render code is the render module of a component and the `r<n>` and `n<n>`
// functions of its client parts; a top-level constant counts for the functions that read it. An
// export that compiled code never calls (only the runtime uses it) is not counted either way.
// Usage, after `pnpm build`: node test/spike/browser-only-exports.mjs [--list]
import { readFileSync, readdirSync } from 'node:fs';
import { compile } from '../../dist/index.js';

const root = new URL('../../', import.meta.url).pathname;
const dir = `${root}test/render/`;
const entry = readFileSync(`${root}src/runtime/client.ts`, 'utf8');
const exported = new Set();
for (const block of entry.matchAll(/export \{([^}]*)\} from/g)) {
  for (const part of block[1].split(',')) {
    const name = part
      .trim()
      .split(/\s+as\s+/)
      .pop();
    if (name) {
      exported.add(name);
    }
  }
}

const render = new Set();
const other = new Set();

function calls(code) {
  return new Set([...code.matchAll(/\$\$b\.(\w+)/g)].map((match) => match[1]));
}

// Splits a part into top-level chunks, each starting at a line with no indent.
function chunks(code) {
  const result = [];
  let current;
  for (const line of code.split('\n')) {
    if (/^\S/.test(line) && !/^[}\])]/.test(line)) {
      current = { head: line, text: line };
      result.push(current);
    } else if (current) {
      current.text += `\n${line}`;
    }
  }
  return result;
}

function addPart(code) {
  const parts = chunks(code);
  const isRender = (chunk) => /^export (?:async )?function [rn]\d+\(/.test(chunk.head);
  for (const chunk of parts) {
    const constant = /^(?:export )?const (\$\$k\d+)\b/.exec(chunk.head);
    let target;
    if (constant) {
      const name = constant[1];
      const readers = parts.filter((other) => other !== chunk && other.text.includes(name));
      target = readers.length > 0 && readers.every(isRender) ? render : other;
    } else {
      target = isRender(chunk) ? render : other;
    }
    for (const name of calls(chunk.text)) {
      target.add(name);
    }
  }
}

let files = 0;
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.brm')) {
    continue;
  }
  let result;
  try {
    result = compile(readFileSync(dir + file, 'utf8'), { filename: file, path: dir + file });
  } catch {
    continue;
  }
  files++;
  for (const name of calls(result.render ?? '')) {
    render.add(name);
  }
  for (const code of Object.values(result.parts ?? {})) {
    addPart(code);
  }
}

const browserOnly = [...exported].filter((name) => render.has(name) && !other.has(name)).sort();
console.log(`${files} components, ${exported.size} exports, ${browserOnly.length} browser-only`);
if (process.argv.includes('--list')) {
  console.log(browserOnly.join(' '));
}
