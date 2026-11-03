// client-audit: sorts the exports of `brumate/client` by who calls them in compiled code.
// render: only browser render code (the render module, `r<n>` and `n<n>` functions);
// other: only resume and update code (the rest of the client parts); both; none: no compiled
// code calls it (only the runtime, the loader or other modules of the package).
// Corpus: test/render, or every .brm of packages/ui, website and examples with --apps.
// Usage, after `pnpm build`: node test/audit/exports.mjs [--apps] [--list]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from '../../dist/index.js';

const root = new URL('../../', import.meta.url).pathname;
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
exported.add('loader');

const render = new Map();
const other = new Map();

function add(target, names) {
  for (const name of names) {
    target.set(name, (target.get(name) ?? 0) + 1);
  }
}

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

function isRender(chunk) {
  return /^export (?:async )?function [rn]\d+\(/.test(chunk.head);
}

function addPart(code) {
  const parts = chunks(code);
  for (const chunk of parts) {
    const constant = /^(?:export )?const (\$\$k\d+)\b/.exec(chunk.head);
    let target;
    if (constant) {
      const readers = [];
      for (const each of parts) {
        if (each !== chunk && each.text.includes(constant[1])) {
          readers.push(each);
        }
      }
      target = readers.length > 0 && readers.every(isRender) ? render : other;
    } else {
      target = isRender(chunk) ? render : other;
    }
    add(target, calls(chunk.text));
  }
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) {
      continue;
    }
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, out);
    } else if (name.endsWith('.brm')) {
      out.push(path);
    }
  }
  return out;
}

const apps = process.argv.includes('--apps');
const files = apps
  ? [
      ...walk(`${root}../ui`, []),
      ...walk(`${root}../../website`, []),
      ...walk(`${root}../../examples`, []),
    ]
  : walk(`${root}test/render`, []);

let compiled = 0;
for (const file of files) {
  let result;
  try {
    result = compile(readFileSync(file, 'utf8'), { filename: file.split('/').pop(), path: file });
  } catch {
    continue;
  }
  compiled++;
  add(render, calls(result.render ?? ''));
  for (const code of Object.values(result.parts ?? {})) {
    addPart(code);
  }
}

const groups = { render: [], other: [], both: [], none: [] };
for (const name of [...exported].sort()) {
  const r = render.has(name);
  const o = other.has(name);
  groups[r && o ? 'both' : r ? 'render' : o ? 'other' : 'none'].push(name);
}
console.log(
  `${compiled} of ${files.length} components, ${exported.size} exports: ` +
    `render-only ${groups.render.length}, resume/update-only ${groups.other.length}, ` +
    `both ${groups.both.length}, no compiled caller ${groups.none.length}`,
);
if (process.argv.includes('--list')) {
  for (const [group, names] of Object.entries(groups)) {
    console.log(`${group}: ${names.join(' ')}`);
  }
}
