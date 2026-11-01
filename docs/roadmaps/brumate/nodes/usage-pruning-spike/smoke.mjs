// Runs the todos and rows benchmark pages in Chrome with a pruned core, checks that each
// interaction works, and prints the share of the core's bytes that ran (V8 block coverage).
// Usage: node smoke.mjs  (after build.sh). Exits 1 when an interaction fails.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { findChrome } from '../../../../../benchmarks/harness/chrome.mjs';

const root = new URL('../../../../../', import.meta.url).pathname;
const require = createRequire(`${root}benchmarks/harness/package.json`);
const { chromium } = require('playwright-core');
const { SourceMapConsumer } = require(
  `${root}node_modules/.pnpm/source-map-js@1.2.2/node_modules/source-map-js`,
);

/** The name of the function of the dist file of brumate at a place of the minified core. */
function namer(dir, url, source) {
  const file = `${dir}${new URL(url).pathname}.map`;
  let map;
  try {
    map = new SourceMapConsumer(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return (offset) => String(offset);
  }
  const lines = [0];
  for (let at = source.indexOf('\n'); at !== -1; at = source.indexOf('\n', at + 1))
    lines.push(at + 1);
  const texts = new Map();
  return (offset) => {
    let line = lines.length - 1;
    while (lines[line] > offset) line--;
    const original = map.originalPositionFor({ line: line + 1, column: offset - lines[line] });
    if (!original.source) return '?';
    let text = texts.get(original.source);
    if (!text) {
      text = readFileSync(new URL(original.source, `file://${file}`), 'utf8').split('\n');
      texts.set(original.source, text);
    }
    const code = text[original.line - 1] ?? '';
    const named =
      /(?:function\*?\s+|(?:const|let|var)\s+|^\s*(?:async\s+)?)([\w$]+)/.exec(
        code.slice(original.column),
      ) ?? /([\w$]+)\s*\(/.exec(code);
    return `${named?.[1] ?? '?'}@${original.source.split('/').pop()}:${original.line}`;
  };
}

function serve(scenario) {
  const child = spawn(process.execPath, ['serve.mjs', 'brumate', scenario], {
    cwd: `${root}benchmarks/harness`,
  });
  return new Promise((resolve, reject) => {
    child.stdout.on('data', (data) => {
      const match = /ready (\d+)/.exec(String(data));
      if (match) resolve({ child, port: Number(match[1]) });
    });
    child.on('exit', (code) => reject(new Error(`serve exited ${code}`)));
  });
}

const SCENARIOS = {
  todos: {
    query: '?n=3',
    steps: [
      [
        'counter',
        (p) => p.locator('h2 + button').click(),
        () => document.querySelector('h2 + button').textContent.includes('1'),
      ],
      [
        'toggle',
        (p) => p.locator('ul li button').nth(1).click(),
        () => document.querySelectorAll('ul li')[1].className.includes('done'),
      ],
      [
        'add',
        async (p) => {
          await p.locator('input').fill('New item');
          await p.locator('form button').click();
        },
        () => document.querySelector('ul li:last-child').textContent.includes('New item'),
      ],
    ],
  },
  rows: {
    query: '?n=1000',
    steps: [
      [
        'select',
        (p) => p.locator('a.lbl').nth(4).click(),
        () => document.querySelectorAll('tr')[4].className === 'danger',
      ],
      [
        'update',
        (p) => p.locator('#update').click(),
        () => document.querySelector('a.lbl').textContent.endsWith('!!!'),
      ],
      [
        'swap',
        (p) => p.locator('#swaprows').click(),
        () => document.querySelectorAll('td.col-md-1')[2].textContent === '999',
      ],
      [
        'remove',
        (p) => p.locator('a.remove').nth(0).click(),
        () => document.querySelectorAll('tbody tr').length === 999,
      ],
      [
        'create',
        (p) => p.locator('#run').click(),
        () => document.querySelectorAll('tbody tr').length === 1000,
      ],
      [
        'clear',
        (p) => p.locator('#clear').click(),
        () => document.querySelectorAll('tbody tr').length === 0,
      ],
    ],
  },
};

const browser = await chromium.launch({ ...findChrome(), headless: true });
let failed = false;
const DIRS = {
  todos: `${root}benchmarks/brumate/dist/client`,
  rows: `${root}benchmarks/brumate/rows/dist/client`,
};
for (const [name, scenario] of Object.entries(SCENARIOS)) {
  const { child, port } = await serve(name);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  // A 404 for /favicon.ico is not an error of the page.
  page.on(
    'console',
    (message) =>
      message.type() === 'error' &&
      !message.text().startsWith('Failed to load resource') &&
      errors.push(message.text()),
  );
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await page.goto(`http://127.0.0.1:${port}/${scenario.query}`);
  await page.waitForLoadState('load');
  await page.waitForTimeout(300);
  for (const [step, run, done] of scenario.steps) {
    await run(page);
    try {
      await page.waitForFunction(done, undefined, { timeout: 3000 });
      console.log(`${name} ${step}: ok`);
    } catch {
      console.log(`${name} ${step}: FAILED`);
      failed = true;
    }
  }
  const coverage = await page.coverage.stopJSCoverage();
  let core;
  for (const entry of coverage) {
    if (
      /\/client-[\w-]+-[\w-]+\.js$/.test(entry.url) &&
      entry.source.length > (core?.source.length ?? 0)
    )
      core = entry;
  }
  for (const entry of core ? [core] : []) {
    const size = entry.source.length;
    // Block coverage: the innermost range with count 0 marks bytes that did not run.
    const ran = new Uint8Array(size);
    for (const fn of entry.functions) {
      for (const range of fn.ranges) {
        ran.fill(range.count > 0 ? 1 : 0, range.startOffset, range.endOffset);
      }
    }
    let used = 0;
    for (const byte of ran) used += byte;
    if (process.env.DUMP) {
      // The functions that never ran, largest first.
      const nameAt = namer(DIRS[name], entry.url, entry.source);
      const cold = [];
      for (const fn of entry.functions) {
        const [whole] = fn.ranges;
        if (whole.count === 0)
          cold.push([whole.endOffset - whole.startOffset, nameAt(whole.startOffset)]);
      }
      cold.sort((a, b) => b[0] - a[0]);
      for (const [n, f] of cold.slice(0, Number(process.env.DUMP)))
        console.log(`  cold ${n}\t${f}`);
    }
    console.log(`${name} core ran ${used} of ${size} B (${((100 * used) / size).toFixed(0)}%)`);
  }
  if (errors.length > 0) {
    console.log(`${name} errors: ${errors.join(' | ')}`);
    failed = true;
  }
  await page.close();
  child.kill();
}
await browser.close();
process.exit(failed ? 1 : 0);
