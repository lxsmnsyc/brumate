// client-audit: the feature flags that each app turns on, from the compiled client code of its
// components, as the Vite plugin reads them (src/features.ts).
// Usage: node --experimental-strip-types test/audit/features.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from '../../dist/index.js';
import { getFeatures, joinFeatures } from '../../src/features.ts';

const root = new URL('../../../../', import.meta.url).pathname;

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

const apps = {
  todos: 'benchmarks/brumate/src',
  rows: 'benchmarks/brumate/rows',
  dashboard: 'benchmarks/brumate/dashboard',
  website: 'website',
  ui: 'packages/ui',
};
for (const dir of readdirSync(`${root}examples`)) {
  apps[`examples/${dir}`] = `examples/${dir}`;
}
for (const [name, dir] of Object.entries(apps)) {
  const all = [];
  for (const file of walk(root + dir, [])) {
    try {
      all.push(getFeatures(compile(readFileSync(file, 'utf8'), { filename: file.split('/').pop(), path: file })));
    } catch {}
  }
  const joined = joinFeatures(all);
  const on = [];
  for (const [key, value] of Object.entries(joined)) {
    if (value) on.push(key);
  }
  console.log(`${name} (${all.length}): ${on.join(' ')}`);
}
