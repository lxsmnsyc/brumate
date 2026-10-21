// Builds every benchmark app, measures it and writes benchmarks/results/<timestamp>.{json,md}.
// Run `pnpm bench --help` from the repository root for the options.
import { execFileSync, fork, spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import {
  measureBrowser,
  measureDashboard,
  measureDashboardWaterfall,
  measureWaterfall,
} from './browser.mjs';
import { MISSING_CHROME, findChrome } from './chrome.mjs';
import { CLICKS, COUNT } from './dashboard.mjs';
import {
  SCENARIOS,
  appDir,
  benchDir,
  discover,
  loadAdapter,
  loadApp,
  repoDir,
  versions,
} from './frameworks.mjs';
import { markdown } from './report.mjs';

const METRICS = ['dist', 'browser', 'ssr-size', 'ssr-speed', 'waterfall'];
const HELP = `Usage: pnpm bench [options]

  --scenario <name>   ${SCENARIOS.join(', ')} or all (default: all).
  --only <names>      Frameworks to run, comma separated (default: all). Found: ${discover().join(', ')}
  --skip <metrics>    Metrics to leave out, comma separated.
  --metrics <names>   Metrics to run, comma separated (default: all).
                      Metrics: ${METRICS.join(', ')}
  --no-build          Use the existing builds.
  --rounds <n>        SSR throughput rounds (default: 5).
  --duration <ms>     Length of one SSR throughput round (default: 1000).
  --idle <ms>         Idle wait after load in the browser (default: 3000).
  --latency <ms>      Round trip latency of the throttled waterfall (default: 150).
  --install-browser   Download Playwright's Chromium when no Chrome is found.
  --help              Show this message.

Set CHROME_PATH to pick the browser.`;

const { values: flags } = parseArgs({
  options: {
    scenario: { type: 'string', default: 'all' },
    only: { type: 'string' },
    skip: { type: 'string' },
    metrics: { type: 'string' },
    'no-build': { type: 'boolean', default: false },
    rounds: { type: 'string', default: '5' },
    duration: { type: 'string', default: '1000' },
    idle: { type: 'string', default: '3000' },
    latency: { type: 'string', default: '150' },
    'install-browser': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  // pnpm passes a lone "--" through when the user writes `pnpm bench -- --only x`.
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
});
if (flags.help) {
  console.log(HELP);
  process.exit(0);
}

const list = (value) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
const all = discover();
const frameworks = list(flags.only) ?? all;
for (const name of frameworks) {
  if (!all.includes(name)) throw new Error(`Unknown framework "${name}". Found: ${all.join(', ')}`);
}
const metrics = new Set(list(flags.metrics) ?? METRICS);
for (const name of list(flags.skip) ?? []) metrics.delete(name);
for (const name of metrics) {
  if (!METRICS.includes(name))
    throw new Error(`Unknown metric "${name}". Metrics: ${METRICS.join(', ')}`);
}
const scenarios = flags.scenario === 'all' ? SCENARIOS : list(flags.scenario);
for (const name of scenarios) {
  if (!SCENARIOS.includes(name))
    throw new Error(`Unknown scenario "${name}". Scenarios: ${SCENARIOS.join(', ')}, all`);
}
const options = {
  rounds: Number(flags.rounds),
  duration: Number(flags.duration),
  idleMs: Number(flags.idle),
  latency: Number(flags.latency),
};

const children = new Set();
const cleanup = () => {
  for (const child of children) child.kill('SIGKILL');
};
process.on('exit', cleanup);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    cleanup();
    process.exit(130);
  });
}

const log = (message) => console.error(`[bench] ${message}`);
const median = (values) => {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function machine() {
  const cpus = os.cpus();
  return {
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: cpus[0]?.model ?? 'unknown',
    cores: cpus.length,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    loadAvg: os.loadavg().map((value) => Math.round(value * 100) / 100),
    node: process.version,
  };
}

function runGit(...args) {
  return execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim();
}

function git() {
  try {
    return {
      commit: runGit('rev-parse', '--short', 'HEAD'),
      dirty: runGit('status', '--porcelain', '--', 'packages').length > 0,
    };
  } catch {
    return undefined;
  }
}

function pnpm(args, cwd) {
  execFileSync('pnpm', args, { cwd, stdio: ['ignore', 'inherit', 'inherit'] });
}

// --- Build -------------------------------------------------------------------

async function build() {
  if (frameworks.includes('brumate')) {
    log('building packages/brumate');
    pnpm(['--filter', 'brumate', 'build'], repoDir);
  }
  for (const name of frameworks) {
    if (scenarios.includes('todos')) {
      log(`building ${name}`);
      await rm(path.join(appDir(name), 'dist'), { recursive: true, force: true });
      pnpm(['run', 'build'], appDir(name));
    }
    if (scenarios.includes('dashboard')) {
      log(`building ${name} dashboard`);
      await rm(path.join(appDir(name), 'dashboard/dist'), { recursive: true, force: true });
      pnpm(['run', 'build:dashboard'], appDir(name));
    }
  }
}

// --- Client JS in dist -------------------------------------------------------

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const file = path.join(dir, entry);
    return statSync(file).isDirectory() ? walk(file) : [file];
  });
}

async function distSize(name, scenario) {
  const { staticDir } = await loadApp(name, scenario);
  const files = walk(staticDir).filter((file) => /\.m?js$/.test(file));
  let raw = 0;
  let gzip = 0;
  for (const file of files) {
    const body = readFileSync(file);
    raw += body.length;
    gzip += gzipSync(body, { level: 9 }).length;
  }
  return { jsFiles: files.length, jsRaw: raw, jsGzip: gzip };
}

// --- Processes ----------------------------------------------------------------

function startServer(name, scenario) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(benchDir, 'harness/serve.mjs'), name, scenario],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    children.add(child);
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
      const match = /ready (\d+)/.exec(out);
      if (match) resolve({ child, base: `http://127.0.0.1:${match[1]}` });
    });
    child.on('exit', (code) => reject(new Error(`server for ${name} exited with ${code}`)));
  });
}

function startWorker(name, scenario) {
  const child = fork(path.join(benchDir, 'harness/worker.mjs'), [name, scenario], {
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  children.add(child);
  let next = 0;
  const waiting = new Map();
  const ready = new Promise((resolve, reject) => {
    child.on('message', (message) => {
      if (message.ready) return resolve();
      const { resolve: done, reject: fail } = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.error) fail(new Error(`${name}: ${message.error}`));
      else done(message.result);
    });
    child.on('exit', (code) => reject(new Error(`worker for ${name} exited with ${code}`)));
  });
  const call = async (type, args) => {
    await ready;
    const id = next++;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      child.send({ id, type, ...args });
    });
  };
  return { call, stop: () => (child.kill(), children.delete(child)) };
}

// --- Run ------------------------------------------------------------------------

const started = new Date();
const result = {
  date: started.toISOString(),
  machine: machine(),
  git: git(),
  options: {
    ...options,
    scenarios,
    frameworks,
    metrics: [...metrics],
    dashboardWidgets: COUNT,
    dashboardClicks: CLICKS,
  },
  versions: {},
  frameworks: {},
  notes: [],
};
for (const name of frameworks) {
  result.versions[name] = await versions(name);
  result.frameworks[name] = { label: (await loadAdapter(name)).label ?? name };
}
if (result.machine.loadAvg[0] > result.machine.cores * 0.5) {
  const note = `The machine was busy at the start (load average ${result.machine.loadAvg[0]} on ${result.machine.cores} cores). Timings may be noisy.`;
  log(note);
  result.notes.push(note);
}

if (!flags['no-build']) await build();

// Where the results of a scenario go. The todos results stay at the top level of each framework.
const slot = (name, scenario) =>
  scenario === 'todos' ? result.frameworks[name] : (result.frameworks[name][scenario] ??= {});
const prefix = (scenario) => (scenario === 'todos' ? '' : `${scenario} `);

for (const scenario of scenarios) {
  if (metrics.has('dist')) {
    for (const name of frameworks) slot(name, scenario).dist = await distSize(name, scenario);
  }
}

// The SSR sizes: 0, 3 and 100 todos, or the one dashboard page.
const SSR_SIZES = { todos: [0, 3, 100], dashboard: [0] };
const SSR_SPEEDS = { todos: [3, 100], dashboard: [0] };

for (const scenario of scenarios) {
  if (!metrics.has('ssr-size') && !metrics.has('ssr-speed')) break;
  const workers = Object.fromEntries(frameworks.map((name) => [name, startWorker(name, scenario)]));
  try {
    if (metrics.has('ssr-size')) {
      log(`measuring ${prefix(scenario)}SSR size`);
      for (const name of frameworks) {
        const size = await workers[name].call('size', { ns: SSR_SIZES[scenario] });
        const problems = Object.entries(size).flatMap(([n, entry]) =>
          entry.problems.map((p) => (scenario === 'todos' ? `n=${n}: ${p}` : p)),
        );
        if (problems.length)
          result.notes.push(`${name} ${prefix(scenario)}SSR output check: ${problems.join('; ')}`);
        slot(name, scenario).ssrSize =
          scenario === 'todos'
            ? {
                ...size,
                perItemRaw: (size[100].raw - size[3].raw) / 97,
                perItemGzip: (size[100].gzip - size[3].gzip) / 97,
              }
            : size[0];
      }
    }
    if (metrics.has('ssr-speed')) {
      log(
        `measuring ${prefix(scenario)}SSR throughput: ${options.rounds} rounds of ${options.duration} ms`,
      );
      const ns = SSR_SPEEDS[scenario];
      const samples = {};
      for (const name of frameworks) {
        samples[name] = Object.fromEntries(ns.map((n) => [n, []]));
        for (const n of ns) await workers[name].call('warmup', { n, count: 300 });
      }
      for (let round = 0; round < options.rounds; round++) {
        // Rotates the order each round so no framework always runs first.
        const order = frameworks.map((_, i) => frameworks[(i + round) % frameworks.length]);
        for (const n of ns) {
          for (const name of order) {
            samples[name][n].push(await workers[name].call('measure', { n, ms: options.duration }));
          }
        }
      }
      for (const name of frameworks) {
        const speed = Object.fromEntries(
          ns.map((n) => [
            n,
            {
              median: Math.round(median(samples[name][n])),
              min: Math.round(Math.min(...samples[name][n])),
              max: Math.round(Math.max(...samples[name][n])),
              samples: samples[name][n].map(Math.round),
            },
          ]),
        );
        slot(name, scenario).ssrSpeed = scenario === 'todos' ? speed : speed[0];
      }
    }
  } finally {
    for (const worker of Object.values(workers)) worker.stop();
  }
}

if (metrics.has('browser') || metrics.has('waterfall')) {
  const launch = findChrome({ install: flags['install-browser'] });
  if (!launch) {
    console.error(MISSING_CHROME);
    result.notes.push('Browser and waterfall metrics were skipped: no Chrome found.');
    metrics.delete('browser');
    metrics.delete('waterfall');
  } else {
    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({ ...launch, headless: true });
    result.browser = {
      executable: launch.executablePath ?? 'playwright chromium',
      version: browser.version(),
    };
    try {
      for (const scenario of scenarios) {
        for (const name of frameworks) {
          const { child, base } = await startServer(name, scenario);
          try {
            if (metrics.has('browser')) {
              log(`${prefix(scenario)}browser: ${name}`);
              const measured =
                scenario === 'todos'
                  ? await measureBrowser(browser, base, { idleMs: options.idleMs, n: 3 })
                  : await measureDashboard(browser, base, {
                      idleMs: options.idleMs,
                      preloadOption: (await loadApp(name, scenario)).preloadOption,
                    });
              const tag = `${name}${scenario === 'todos' ? '' : ` ${scenario}`}`;
              if (measured.failed.length)
                result.notes.push(`${tag}: interactions failed: ${measured.failed.join(', ')}`);
              if (measured.errors.length)
                result.notes.push(`${tag}: page errors: ${measured.errors.join(' | ')}`);
              slot(name, scenario).browser = measured;
            }
            if (metrics.has('waterfall')) {
              log(`${prefix(scenario)}waterfall: ${name}`);
              slot(name, scenario).waterfall =
                scenario === 'todos'
                  ? await measureWaterfall(browser, base, options)
                  : await measureDashboardWaterfall(browser, base, options);
            }
          } finally {
            child.kill();
            children.delete(child);
          }
        }
      }
    } finally {
      await browser.close();
    }
  }
}

result.machine.loadAvgEnd = os.loadavg().map((value) => Math.round(value * 100) / 100);
result.durationSeconds = Math.round((Date.now() - started.getTime()) / 1000);

const text = markdown(result, metrics);
const stamp = started.toISOString().replace(/[:.]/g, '-');
const resultsDir = path.join(benchDir, 'results');
await mkdir(resultsDir, { recursive: true });
await writeFile(path.join(resultsDir, `${stamp}.json`), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(path.join(resultsDir, `${stamp}.md`), text);
console.log(text);
log(`wrote benchmarks/results/${stamp}.json and .md`);
process.exit(0);
