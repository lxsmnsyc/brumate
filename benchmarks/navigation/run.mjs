// Measures one client navigation between two pages that share layouts, on a production build:
// the size of the response (raw and gzip), the HTML of the route regions that change, the time from
// the click to the end of the swap, and the JS that the first navigation loads. See README.md.
//
//   node benchmarks/navigation/run.mjs [--pairs docs-server,...] [--runs 20] [--build] [--no-build]
//     [--check] [--expect full|partial] [--json file]
//     [--network fast4g|slow4g] [--cpu 4] [--gzip] [--first-load] [--load-pages /,/docs/components/]
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { findChrome } from '../harness/chrome.mjs';
import { exec, repo } from '../../e2e/lib.mjs';
import { gzip, regionBytes, size } from './regions.mjs';
import { serveServer, serveStatic } from './serve.mjs';

// playwright-core is a dependency of e2e, and the benchmarks pin the same version.
const { chromium } = createRequire(path.join(repo, 'e2e/package.json'))('playwright-core');

/**
 * The pairs. `keep` is an element of a layout that the navigation keeps: it carries a mark through the
 * swap, which shows whether the client replaced routes or the whole body.
 */
const PAIRS = {
  'docs-static': {
    app: 'website',
    mode: 'static',
    from: '/docs/styles',
    to: '/docs/context',
    link: '.sidebar a[href="/docs/context"]',
    keep: '.sidebar',
  },
  'docs-server': {
    app: 'website',
    mode: 'server',
    from: '/docs/styles',
    to: '/docs/context',
    link: '.sidebar a[href="/docs/context"]',
    keep: '.sidebar',
  },
  'ui-static': {
    app: 'website',
    mode: 'static',
    from: '/ui/button',
    to: '/ui/dialog',
    link: '.sidebar a[href="/ui/dialog"]',
    keep: '.sidebar',
  },
  'ui-server': {
    app: 'website',
    mode: 'server',
    from: '/ui/button',
    to: '/ui/dialog',
    link: '.sidebar a[href="/ui/dialog"]',
    keep: '.sidebar',
  },
  // Two layouts and a parallel `@aside` slot (examples/tracker).
  'tracker-server': {
    app: 'tracker',
    mode: 'server',
    from: '/about',
    to: '/team',
    link: 'header nav a[href="/team"]',
    keep: 'header',
  },
};
/**
 * The network profiles of Chrome DevTools (core/sdk/NetworkManager.ts in devtools-frontend, read
 * 2026-11-19). The throughput is in bytes per second. DevTools takes 90% of the nominal rate and
 * multiplies the round-trip time (2.75 for Fast 4G, 3.75 for Slow 4G), as it does for its own presets.
 */
const NETWORKS = {
  fast4g: {
    download: ((9 * 1000 * 1000) / 8) * 0.9,
    upload: ((1.5 * 1000 * 1000) / 8) * 0.9,
    latency: 60 * 2.75,
  },
  slow4g: {
    download: ((1.6 * 1000 * 1000) / 8) * 0.9,
    upload: ((750 * 1000) / 8) * 0.9,
    latency: 150 * 3.75,
  },
};
const LOAD_PAGES = ['/', '/docs/components/'];
const APPS = {
  website: { root: path.join(repo, 'website'), filter: 'website' },
  tracker: { root: path.join(repo, 'examples/tracker'), filter: 'example-tracker' },
};

const { values } = parseArgs({
  options: {
    pairs: { type: 'string' },
    runs: { type: 'string', default: '20' },
    check: { type: 'boolean', default: false },
    expect: { type: 'string', default: 'full' },
    input: { type: 'string', default: 'script' },
    build: { type: 'boolean', default: false },
    'no-build': { type: 'boolean', default: false },
    json: { type: 'string' },
    network: { type: 'string' },
    cpu: { type: 'string', default: '1' },
    gzip: { type: 'boolean', default: false },
    'first-load': { type: 'boolean', default: false },
    'load-pages': { type: 'string' },
    label: { type: 'string' },
    'install-browser': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(`node benchmarks/navigation/run.mjs [options]
  --pairs a,b      the pairs to measure (default: all, or ${DEFAULT_CHECK().join(',')} with --check)
                   ${Object.keys(PAIRS).join(', ')}
  --runs N         measured runs for each pair (default 20, 1 with --check)
  --check          one run, assert the numbers and the kind of the response, exit 0 or 1
  --expect KIND    full or partial: what the response must be (default full)
  --input KIND     script: the page calls link.click(), so no hover or focus prefetch starts first
                   (default); mouse: a real click, which a hover or focus can prefetch for
  --build          build the packages and the apps first (default: only when a dist is missing)
  --no-build       never build
  --json FILE      write the results as JSON
  --network NAME   throttle the network like the DevTools preset: ${Object.keys(NETWORKS).join(', ')} (default: off)
  --cpu N          slow the CPU down N times (default 1, off)
  --gzip           the server compresses HTML, JS and CSS with gzip, as a host does (default: off)
  --first-load     also measure the first load of pages with an empty cache, and a second load
                   with the cache kept: FCP, LCP and the CSS (server mode, the website)
  --load-pages a,b the pages of --first-load (default ${LOAD_PAGES.join(',')})
  --label NAME     a name for this build, kept in the JSON
  --install-browser  download Playwright's Chromium when no Chrome is found`);
  process.exit(0);
}

function DEFAULT_CHECK() {
  return ['docs-static', 'docs-server'];
}

if (values.network && !(values.network in NETWORKS)) {
  console.error(`--network is ${Object.keys(NETWORKS).join(' or ')}.`);
  process.exit(2);
}
const NETWORK = values.network ? NETWORKS[values.network] : undefined;
const CPU = Number(values.cpu);
if (!(CPU >= 1)) {
  console.error('--cpu is a number of at least 1.');
  process.exit(2);
}
const LOADS = [];
if (values['first-load']) {
  for (const page of (values['load-pages'] ?? LOAD_PAGES.join(',')).split(',')) {
    LOADS.push(page.trim());
  }
}
if (!['full', 'partial'].includes(values.expect) || !['script', 'mouse'].includes(values.input)) {
  console.error('--expect is full or partial, and --input is script or mouse.');
  process.exit(2);
}
let names = Object.keys(PAIRS);
if (values.pairs) {
  names = [];
  for (const name of values.pairs.split(',')) {
    names.push(name.trim());
  }
} else if (values.check) {
  names = DEFAULT_CHECK();
}
for (const name of names) {
  if (!(name in PAIRS)) {
    console.error(`Unknown pair: ${name}. The pairs are ${Object.keys(PAIRS).join(', ')}.`);
    process.exit(2);
  }
}
const RUNS = values.check ? 1 : Number(values.runs);
if (!Number.isInteger(RUNS) || RUNS < 1) {
  console.error('--runs is a positive integer.');
  process.exit(2);
}
const launch = findChrome({ install: values['install-browser'] });
if (!launch) {
  console.error(`No Chrome found. Set CHROME_PATH, or pass --install-browser.`);
  process.exit(2);
}

/** The value at a rank of the sorted samples, the nearest-rank method. */
function percentile(samples, p) {
  const sorted = samples.toSorted(compare);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
function compare(a, b) {
  return a - b;
}
/** The values of one field of each item. */
function pluck(list, field) {
  const found = [];
  for (const item of list) {
    found.push(item[field]);
  }
  return found;
}
function sum(list, field) {
  let total = 0;
  for (const item of list) {
    total += item[field];
  }
  return total;
}
const median = (samples) => percentile(samples, 0.5);
const round = (value, digits = 1) => Number(value.toFixed(digits));

function fail(message) {
  throw new Error(message);
}

async function build(apps) {
  let missing = false;
  for (const app of apps) {
    const { root } = APPS[app];
    if (
      !existsSync(path.join(root, 'dist/client')) ||
      !existsSync(path.join(root, 'dist/server/server.js'))
    ) {
      missing = true;
    }
  }
  if (values['no-build'] || (!values.build && !missing)) {
    return;
  }
  const steps = [['pnpm', ['build']]];
  for (const app of apps) {
    steps.push(['pnpm', ['--filter', APPS[app].filter, 'build']]);
  }
  for (const [command, args] of steps) {
    console.log(`building: ${command} ${args.join(' ')}`);
    await exec(command, args);
  }
}

const INIT = () => {
  // Marks of the page: the click, the end of the swap, and the next frame. `history.pushState` runs
  // right after `replaceRoutes` or the swap of the body, in the same task.
  window.__nav = { click: 0, end: 0, frame: 0 };
  window.addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Element && event.target.closest('a')) {
        window.__nav.click = performance.now();
      }
    },
    true,
  );
  // The last largest contentful paint, which the load measurement reads.
  window.__lcp = 0;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__lcp = entry.startTime;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // No LCP in this browser.
  }
  const push = history.pushState;
  history.pushState = function (...args) {
    const result = push.apply(this, args);
    window.__nav.end = performance.now();
    requestAnimationFrame(() => {
      window.__nav.frame = performance.now();
    });
    return result;
  };
};

/** One navigation on a fresh load of the first page. Returns undefined when the client did not take the click. */
async function navigateOnce(page, site, pair, { javascript } = {}) {
  const answer = await page.goto(site + pair.from, { waitUntil: 'load', timeout: 120_000 });
  const fromHtml = await answer.text();
  // The client starts after the page loads. A click before it follows the link as the browser does.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.evaluate(
    ([keep]) => {
      window.__same = true;
      document.querySelector(keep).__kept = true;
    },
    [pair.keep],
  );
  const target = new URL(pair.to, site).href;
  const loaded = page.waitForResponse(
    (response) => response.url() === target && response.request().resourceType() === 'fetch',
    { timeout: 10_000 },
  );
  loaded.catch(() => {});
  const load = os.loadavg()[0];
  javascript?.start();
  if (values.input === 'mouse') {
    await page.locator(pair.link).click();
  } else {
    await page.evaluate((link) => document.querySelector(link).click(), pair.link);
  }
  try {
    // The resource entry of a fetch exists once its response has ended, so its sizes are final.
    await page.waitForFunction(
      (href) =>
        window.__nav?.end > 0 &&
        window.__nav.frame > 0 &&
        performance
          .getEntriesByType('resource')
          .some((entry) => entry.name === href && entry.initiatorType === 'fetch'),
      target,
      { timeout: 10_000 },
    );
  } catch {
    return undefined;
  }
  const outcome = await page.evaluate(
    ([keep, href]) => {
      const entries = performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name === href && entry.initiatorType === 'fetch');
      const entry = entries.at(-1);
      return {
        nav: window.__nav,
        samePage: window.__same === true,
        kept: Boolean(document.querySelector(keep)?.__kept),
        path: location.pathname,
        timing: entry && {
          start: entry.startTime,
          responseStart: entry.responseStart,
          responseEnd: entry.responseEnd,
          transfer: entry.transferSize,
          encoded: entry.encodedBodySize,
          decoded: entry.decodedBodySize,
        },
      };
    },
    [pair.keep, target],
  );
  if (!outcome.samePage || !outcome.timing || outcome.path !== new URL(pair.to, site).pathname) {
    return undefined;
  }
  const response = await loaded;
  const body = (await response.body()).toString('utf8');
  const headers = response.headers();
  const { nav, timing } = outcome;
  return {
    load,
    fromHtml,
    body,
    partial: headers['x-brumate-partial'] === '1',
    swapKind: outcome.kept ? 'routes' : 'body',
    // Milliseconds from the click.
    swap: nav.end - nav.click,
    frame: nav.frame - nav.click,
    wait: timing.responseStart - nav.click,
    read: nav.end - timing.responseStart,
    transfer: timing.transfer,
    decoded: timing.decoded,
    encoded: timing.encoded,
    location: { from: pair.from, to: pair.to },
  };
}

async function newPage(browser) {
  const context = await browser.newContext();
  await context.addInitScript(INIT);
  const page = await context.newPage();
  await throttle(context, page);
  return { page, context };
}

/** Throttles the network and the CPU of a page, as the DevTools panels do, through the protocol. */
async function throttle(context, page) {
  if (!NETWORK && CPU === 1) {
    return;
  }
  const session = await context.newCDPSession(page);
  if (NETWORK) {
    await session.send('Network.enable');
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: NETWORK.latency,
      downloadThroughput: NETWORK.download,
      uploadThroughput: NETWORK.upload,
    });
  }
  if (CPU > 1) {
    await session.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  }
}

/** One load of a page: the paint times, and the CSS that the page loaded. */
async function loadOnce(page, url) {
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction(
    () => performance.getEntriesByName('first-contentful-paint').length > 0,
    undefined,
    { timeout: 60_000 },
  );
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
  return page.evaluate(() => {
    const css = [];
    let cssBlocking = 0;
    let cssDecoded = 0;
    let cssTransfer = 0;
    for (const entry of performance.getEntriesByType('resource')) {
      if (new URL(entry.name).pathname.endsWith('.css')) {
        const blocking = entry.renderBlockingStatus === 'blocking';
        cssBlocking += blocking ? 1 : 0;
        cssDecoded += entry.decodedBodySize;
        cssTransfer += entry.transferSize;
        css.push({
          url: new URL(entry.name).pathname,
          transfer: entry.transferSize,
          encoded: entry.encodedBodySize,
          decoded: entry.decodedBodySize,
          blocking,
        });
      }
    }
    let inline = 0;
    for (const style of document.querySelectorAll('style')) {
      inline += new Blob([style.textContent]).size;
    }
    const document_ = performance.getEntriesByType('navigation')[0];
    // The order of the head: where the stylesheets sit among the scripts and the other tags.
    const head = [];
    for (const child of document.head.children) {
      head.push(
        child.tagName.toLowerCase() +
          (child.tagName === 'LINK' ? `[${child.rel}]` : '') +
          (child.tagName === 'STYLE' ? `(${child.textContent.length})` : ''),
      );
    }
    return {
      fcp: performance.getEntriesByName('first-contentful-paint')[0].startTime,
      lcp: window.__lcp,
      responseEnd: document_.responseEnd,
      dom: document_.domContentLoadedEventEnd,
      load: document_.loadEventStart,
      htmlTransfer: document_.transferSize,
      htmlDecoded: document_.decodedBodySize,
      css,
      cssFiles: css.length,
      cssBlocking,
      cssDecoded: inline + cssDecoded,
      cssTransfer,
      inline,
      head,
    };
  });
}

/** A first load with an empty cache (a new context), and then a second load with the cache kept. */
async function loadPage(browser, url) {
  const { page, context } = await newPage(browser);
  try {
    const cold = await loadOnce(page, url);
    await page.goto('about:blank');
    const warm = await loadOnce(page, url);
    return { cold, warm };
  } finally {
    await context.close();
  }
}

/**
 * The files of the build are under /assets. Others are modules that the page makes at run time, such
 * as the code of a live sample.
 */
function totalScripts(list) {
  const built = [];
  for (const item of list) {
    if (item.url.startsWith('/assets/')) {
      built.push(item);
    }
  }
  return {
    files: list.length,
    raw: sum(list, 'raw'),
    gzip: sum(list, 'gzip'),
    builtFiles: built.length,
    builtGzip: sum(built, 'gzip'),
    list: list.toSorted(byGzip),
  };
}
function byGzip(a, b) {
  return b.gzip - a.gzip;
}

/** The scripts that the first load and the first navigation fetch, in a browser with a cold cache. */
async function measureScripts(browser, site, pair) {
  const { page, context } = await newPage(browser);
  const scripts = { load: [], navigation: [] };
  let phase = 'load';
  const pending = [];
  page.on('response', (response) => {
    const type = response.headers()['content-type'] ?? '';
    if (!/javascript/.test(type) && !/\.m?js(\?|$)/.test(response.url())) {
      return;
    }
    const list = scripts[phase];
    pending.push(
      response
        .body()
        .then((body) => {
          const text = body.toString('utf8');
          list.push({
            url: new URL(response.url()).pathname,
            raw: body.length,
            gzip: gzip(text),
          });
        })
        .catch(() => {}),
    );
  });
  try {
    const run = await navigateOnce(page, site, pair, {
      javascript: {
        start() {
          phase = 'navigation';
        },
      },
    });
    if (!run) {
      return undefined;
    }
    // Scripts that the new page asks for after the swap.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(500);
    await Promise.all(pending);
    return { load: totalScripts(scripts.load), navigation: totalScripts(scripts.navigation) };
  } finally {
    await context.close();
  }
}

/** A page that measures one pair, one run at a time, so the pairs can take turns under a varying load. */
async function openPair(browser, name, pair, site) {
  const { page, context } = await newPage(browser);
  const runs = [];
  const loads = [];
  let tries = 0;
  // One run first, which warms the server and the cache of the scripts, and is not counted.
  if (!values.check) {
    await navigateOnce(page, site, pair);
  }
  const loadBefore = os.loadavg()[0];
  return {
    name,
    async step() {
      for (;;) {
        if (++tries > RUNS * 3 + 3) {
          fail(`${name}: the client took the click in only ${runs.length} of ${tries - 1} tries.`);
        }
        const run = await navigateOnce(page, site, pair);
        if (run) {
          runs.push(run);
          loads.push(run.load);
          return;
        }
      }
    },
    async finish() {
      await context.close();
      const first = runs[0];
      const raw = [];
      const zipped = [];
      for (const run of runs) {
        raw.push(size(run.body));
        zipped.push(gzip(run.body));
      }
      return {
        name,
        app: pair.app,
        mode: pair.mode,
        from: pair.from,
        to: pair.to,
        runs: runs.length,
        partial: first.partial,
        swapKind: first.swapKind,
        response: {
          raw: median(raw),
          rawRange: [Math.min(...raw), Math.max(...raw)],
          gzip: median(zipped),
          gzipRange: [Math.min(...zipped), Math.max(...zipped)],
          transfer: median(pluck(runs, 'transfer')),
          decoded: median(pluck(runs, 'decoded')),
          encoded: median(pluck(runs, 'encoded')),
        },
        regions: regionBytes(first.fromHtml, first.body),
        samples: { swap: pluck(runs, 'swap') },
        time: {
          swap: stats(pluck(runs, 'swap')),
          frame: stats(pluck(runs, 'frame')),
          wait: stats(pluck(runs, 'wait')),
          read: stats(pluck(runs, 'read')),
        },
        load: {
          before: round(loadBefore, 2),
          after: round(os.loadavg()[0], 2),
          median: round(median(loads), 2),
          p90: round(percentile(loads, 0.9), 2),
          max: round(Math.max(...loads), 2),
        },
      };
    },
  };
}

function stats(samples) {
  return {
    median: round(median(samples)),
    p90: round(percentile(samples, 0.9)),
    min: round(Math.min(...samples)),
    max: round(Math.max(...samples)),
  };
}

function loadAverages() {
  const found = [];
  for (const value of os.loadavg()) {
    found.push(round(value, 2));
  }
  return found;
}

function git(...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

function table(rows) {
  const widths = [];
  for (let index = 0; index < rows[0].length; index++) {
    let width = 0;
    for (const row of rows) {
      width = Math.max(width, String(row[index]).length);
    }
    widths.push(width);
  }
  const lines = [];
  for (const row of rows) {
    const cells = [];
    for (let index = 0; index < row.length; index++) {
      cells.push(String(row[index]).padEnd(widths[index]));
    }
    lines.push(`| ${cells.join(' | ')} |`);
    if (lines.length === 1) {
      const rules = [];
      for (const width of widths) {
        rules.push('-'.repeat(width + 2));
      }
      lines.push(`|${rules.join('|')}|`);
    }
  }
  return lines.join('\n');
}

function verify(result, expect) {
  const problems = [];
  const { response, regions, time } = result;
  if (!(response.raw > 0)) problems.push('the raw size is not positive');
  if (!(response.gzip > 0)) problems.push('the gzip size is not positive');
  if (!(time.swap.median > 0 && Number.isFinite(time.swap.median))) {
    problems.push('the time to swap is not positive');
  }
  if (response.decoded !== response.raw) {
    problems.push(
      `the body is ${response.raw} bytes, the browser says ${response.decoded} (decoded body size)`,
    );
  }
  if (result.partial !== (expect === 'partial')) {
    problems.push(`the response is ${result.partial ? 'partial' : 'full'}, expected ${expect}`);
  }
  if (!regions) {
    problems.push('the route regions of the two pages do not line up');
  } else if (!(regions.raw > 0 && regions.raw <= response.raw)) {
    problems.push(`the changing regions are ${regions.raw} bytes of ${response.raw}`);
  }
  // A static host ignores the request header, and the client moves the IDs of the page it gets
  // (`shiftFor`), so it also replaces only the routes and keeps the layouts.
  if (result.swapKind !== 'routes') {
    problems.push(`the swap replaced the ${result.swapKind}, expected the routes`);
  }
  return problems;
}

const apps = [];
for (const name of names) {
  if (!apps.includes(PAIRS[name].app)) {
    apps.push(PAIRS[name].app);
  }
}
await build(apps);

const browser = await chromium.launch({ ...launch, headless: true });
const servers = new Map();
async function serverFor(pair) {
  const key = `${pair.app}:${pair.mode}`;
  if (!servers.has(key)) {
    servers.set(
      key,
      pair.mode === 'static'
        ? await serveStatic()
        : await serveServer(APPS[pair.app].root, { gzip: values.gzip }),
    );
  }
  return servers.get(key).url;
}

/** The pages take turns in each round, so a change of the load of the machine reaches all of them. */
async function measureLoads() {
  const found = [];
  const site = LOADS.length > 0 ? await serverFor({ app: 'website', mode: 'server' }) : '';
  for (const route of LOADS) {
    // One load first, which warms the server and the pages it reads, and is not counted.
    await loadPage(browser, site + route);
    found.push({ page: route, runs: [], load: [] });
  }
  for (let turn = 1; turn <= RUNS && LOADS.length > 0; turn++) {
    console.error(`first load ${turn} of ${RUNS}, load ${os.loadavg()[0].toFixed(1)}`);
    for (const item of found) {
      item.load.push(round(os.loadavg()[0], 2));
      item.runs.push(await loadPage(browser, site + item.page));
    }
  }
  const out = [];
  for (const item of found) {
    const { runs } = item;
    out.push({
      page: item.page,
      cold: summarize(pluck(runs, 'cold')),
      warm: summarize(pluck(runs, 'warm')),
      head: runs[0].cold.head,
      css: runs[0].cold.css,
      samples: {
        coldFcp: pluck(pluck(runs, 'cold'), 'fcp'),
        warmFcp: pluck(pluck(runs, 'warm'), 'fcp'),
        coldLcp: pluck(pluck(runs, 'cold'), 'lcp'),
        warmLcp: pluck(pluck(runs, 'warm'), 'lcp'),
      },
      loadAverage: { median: round(median(item.load), 2), max: round(Math.max(...item.load), 2) },
    });
  }
  return out;
}

function summarize(loads) {
  const first = loads[0];
  return {
    fcp: stats(pluck(loads, 'fcp')),
    lcp: stats(pluck(loads, 'lcp')),
    responseEnd: stats(pluck(loads, 'responseEnd')),
    cssFiles: first.cssFiles,
    cssBlocking: first.cssBlocking,
    cssDecoded: first.cssDecoded,
    cssTransfer: first.cssTransfer,
    inline: first.inline,
    htmlTransfer: first.htmlTransfer,
    htmlDecoded: first.htmlDecoded,
  };
}

function printLoads(loads) {
  if (loads.length === 0) {
    return;
  }
  const rows = [
    [
      'page',
      'cache',
      'FCP ms med',
      'min',
      'max',
      'LCP med',
      'CSS files',
      'blocking',
      'CSS B',
      'CSS transfer B',
      'HTML transfer B',
    ],
  ];
  for (const item of loads) {
    for (const cache of ['cold', 'warm']) {
      const one = item[cache];
      rows.push([
        item.page,
        cache,
        one.fcp.median,
        one.fcp.min,
        one.fcp.max,
        one.lcp.median,
        one.cssFiles,
        one.cssBlocking,
        one.cssDecoded,
        one.cssTransfer,
        one.htmlTransfer,
      ]);
    }
  }
  console.log(table(rows));
}

const results = [];
let code = 0;
try {
  // The pairs take turns in each round, so a change of the load of the machine reaches all of them.
  const open = [];
  for (const name of names) {
    open.push(await openPair(browser, name, PAIRS[name], await serverFor(PAIRS[name])));
  }
  for (let turn = 1; turn <= RUNS; turn++) {
    console.error(`run ${turn} of ${RUNS}, load ${os.loadavg()[0].toFixed(1)}`);
    for (const item of open) {
      await item.step();
    }
  }
  for (const item of open) {
    results.push(await item.finish());
  }
  if (!values.check) {
    for (const result of results) {
      result.scripts = await measureScripts(
        browser,
        await serverFor(PAIRS[result.name]),
        PAIRS[result.name],
      );
    }
  }
  const loads = await measureLoads();
  const meta = {
    commit: git('rev-parse', 'HEAD'),
    dirty: git('status', '--porcelain', '--', 'packages', 'website', 'examples').length > 0,
    browser: browser.version(),
    label: values.label,
    network: values.network ?? 'off',
    cpuThrottle: CPU === 1 ? 'off' : CPU,
    gzip: values.gzip,
    input: values.input,
    runs: RUNS,
    cpus: os.cpus().length,
    memoryGB: round(os.totalmem() / 1024 ** 3, 1),
    node: process.version,
    date: new Date().toISOString(),
    loadAtEnd: loadAverages(),
  };
  const rows = [
    [
      'pair',
      'response',
      'raw B',
      'gzip B',
      'regions raw',
      'regions gzip',
      'swap ms med',
      'p90',
      'wait ms',
      'read ms',
      'swap',
      'load',
    ],
  ];
  for (const result of results) {
    rows.push([
      result.name,
      result.partial ? 'partial' : 'full',
      result.response.raw,
      result.response.gzip,
      result.regions?.raw ?? '-',
      result.regions?.gzip ?? '-',
      result.time.swap.median,
      result.time.swap.p90,
      result.time.wait.median,
      result.time.read.median,
      result.swapKind,
      `${result.load.median} (p90 ${result.load.p90})`,
    ]);
  }
  console.log(
    `commit ${meta.commit.slice(0, 8)}${meta.dirty ? ' (dirty)' : ''}, ${meta.browser}, ${RUNS} runs, network ${meta.network}, CPU throttle ${meta.cpuThrottle}, ${meta.cpus} CPUs`,
  );
  console.log(table(rows));
  printLoads(loads);
  for (const result of results) {
    if (result.scripts) {
      const { load, navigation } = result.scripts;
      console.log(
        `${result.name}: JS of the first load ${load.files} files, ${load.gzip} B gzip (${load.builtFiles} built files, ${load.builtGzip} B); of the first navigation ${navigation.files} files, ${navigation.gzip} B gzip (${navigation.builtFiles} built files, ${navigation.builtGzip} B)`,
      );
    }
  }
  if (values.json) {
    writeFileSync(
      path.resolve(values.json),
      `${JSON.stringify({ meta, results, loads }, null, 2)}\n`,
    );
  }
  if (values.check) {
    for (const result of results) {
      const problems = verify(result, values.expect);
      for (const problem of problems) {
        console.error(`FAIL ${result.name}: ${problem}`);
      }
      if (problems.length > 0) {
        code = 1;
      } else {
        console.log(`ok   ${result.name}`);
      }
    }
  }
} catch (error) {
  console.error(error.stack ?? error);
  code = 1;
} finally {
  const stops = [];
  for (const server of servers.values()) {
    stops.push(server.stop());
  }
  await Promise.allSettled(stops);
  await browser.close().catch(() => {});
}
process.exit(code);
