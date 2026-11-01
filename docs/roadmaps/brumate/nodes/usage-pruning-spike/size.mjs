// Gzip size of the JS a page loads at start, for the spike on usage pruning.
// Usage: node size.mjs [label]  (after building the apps; see build.sh)
// For the benchmarks: the files of hints.json (all and every bundle) plus the entry, as the
// bench adapter links them. For the website: hints.all (the files every page loads) and the core
// chunk alone, since the core is what pruning changes.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const root = new URL('../../../../../', import.meta.url).pathname;

function gzip(file) {
  const body = readFileSync(file);
  return { raw: body.length, gzip: gzipSync(body, { level: 9 }).length };
}

function sum(dir, urls) {
  let raw = 0;
  let gz = 0;
  for (const url of urls) {
    const size = gzip(`${dir}${url}`);
    raw += size.raw;
    gz += size.gzip;
  }
  return { raw, gzip: gz };
}

function core(dir, urls) {
  // The core chunk is the largest of the start files whose name starts with `client-`.
  let best = { raw: 0, gzip: 0 };
  for (const url of urls) {
    if (!/\/client-[\w-]+-[\w-]+\.js$/.test(url)) continue;
    const size = gzip(`${dir}${url}`);
    if (size.raw > best.raw) best = size;
  }
  return best;
}

function bench(app) {
  const dir = `${root}${app}/dist/client`;
  const manifest = JSON.parse(readFileSync(`${dir}/.vite/manifest.json`, 'utf8'));
  const hints = JSON.parse(readFileSync(`${dir}/.brumate/hints.json`, 'utf8'));
  const urls = new Set([...hints.all, ...Object.values(hints.bundles).flat()]);
  urls.add(`/${manifest['src/client.ts'].file}`);
  return { page: sum(dir, urls), core: core(dir, urls) };
}

function website() {
  const dir = `${root}website/dist/client`;
  const hints = JSON.parse(readFileSync(`${dir}/.brumate/hints.json`, 'utf8'));
  return { page: sum(dir, hints.all), core: core(dir, hints.all) };
}

const rows = {
  todos: bench('benchmarks/brumate'),
  dashboard: bench('benchmarks/brumate/dashboard'),
  rows: bench('benchmarks/brumate/rows'),
  website: website(),
};
const label = process.argv[2] ?? 'run';
console.log(JSON.stringify({ label, ...rows }));
for (const [name, { page, core: c }] of Object.entries(rows)) {
  console.log(`${label}\t${name}\tpage ${page.raw}/${page.gzip}\tcore ${c.raw}/${c.gzip}`);
}
