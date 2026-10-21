import { gzipSync } from 'node:zlib';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isScript = (entry) => entry.type === 'script' || /\.m?js(\?|$)/.test(entry.url);

// The interactions. Each one has an action and a check that runs in the page.
const INTERACTIONS = {
  counter: {
    run: (page) => page.locator('h2 + button').click(),
    done: () =>
      document.querySelector('h2 + button').textContent.includes('Clicked 1 times') &&
      document.body.textContent.includes('Double: 2'),
  },
  toggle: {
    run: (page) => page.locator('ul li button').nth(1).click(),
    done: () =>
      /(\d+) left/.exec(document.body.textContent)?.[1] === String(window.__left - 1) &&
      document.querySelectorAll('ul li')[1].className.includes('done'),
  },
  add: {
    run: async (page) => {
      await page.locator('input').fill('New item');
      await page.locator('form button').click();
    },
    done: () =>
      document.querySelector('ul li:last-child').textContent.includes('New item') &&
      document.querySelector('input').value === '',
  },
};

function total(entries) {
  const js = entries.filter(isScript);
  return {
    requests: entries.length,
    jsFiles: js.length,
    jsRaw: js.reduce((sum, entry) => sum + entry.raw, 0),
    jsGzip: js.reduce((sum, entry) => sum + entry.gzip, 0),
  };
}

// Loads the page, waits while idle, then runs the interactions in order. Records every
// request with the phase in which it started.
async function session(browser, base, order, { idleMs, n }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageUrl = `${base}/?n=${n}`;
  const log = [];
  const pending = [];
  const phaseOf = new Map();
  let phase = 'boot';
  page.on('request', (request) => phaseOf.set(request, phase));
  page.on('response', (response) => {
    const url = response.url();
    if (!url.startsWith(base) || url === pageUrl) return;
    pending.push(
      response.body().then(
        (body) =>
          log.push({
            phase: phaseOf.get(response.request()),
            url: url.slice(base.length),
            type: response.request().resourceType(),
            raw: body.length,
            gzip: gzipSync(body, { level: 9 }).length,
          }),
        () => {},
      ),
    );
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto(pageUrl, { waitUntil: 'load' });
  phase = 'idle';
  await page.waitForLoadState('networkidle');
  await sleep(idleMs);
  await page.evaluate(() => {
    window.__left = Number(/(\d+) left/.exec(document.body.textContent)[1]);
  });

  const checks = {};
  for (const name of order) {
    phase = name;
    const start = performance.now();
    await INTERACTIONS[name].run(page);
    try {
      await page.waitForFunction(INTERACTIONS[name].done, null, { timeout: 5000 });
      checks[name] = Math.round(performance.now() - start);
    } catch {
      checks[name] = 'FAILED';
    }
    await sleep(1000);
  }
  await Promise.all(pending);
  await context.close();

  const phases = {};
  for (const name of ['boot', 'idle', ...order])
    phases[name] = total(log.filter((entry) => entry.phase === name));
  return { order, checks, errors, phases, all: total(log), log };
}

export async function measureBrowser(browser, base, options) {
  const counterFirst = await session(browser, base, ['counter', 'toggle', 'add'], options);
  const toggleFirst = await session(browser, base, ['toggle', 'counter', 'add'], options);
  const failed = [counterFirst, toggleFirst].flatMap((s) =>
    Object.entries(s.checks)
      .filter(([, value]) => value === 'FAILED')
      .map(([name]) => `${name} (${s.order[0]} first)`),
  );
  return {
    boot: counterFirst.phases.boot,
    idle: counterFirst.phases.idle,
    firstCounter: counterFirst.phases.counter,
    firstToggle: toggleFirst.phases.toggle,
    total: counterFirst.all,
    checks: { counterFirst: counterFirst.checks, toggleFirst: toggleFirst.checks },
    failed,
    errors: [...new Set([...counterFirst.errors, ...toggleFirst.errors])],
    sessions: { counterFirst, toggleFirst },
  };
}

// Counts the sequential network round trips between a click and the DOM update.
// A request is one trip deeper than the deepest request that finished before it started.
function roundTrips(requests) {
  const sorted = requests.toSorted((a, b) => a.start - b.start);
  let max = 0;
  for (const request of sorted) {
    const before = sorted.filter(
      (other) => other !== request && other.end !== undefined && other.end <= request.start,
    );
    request.depth = 1 + Math.max(0, ...before.map((other) => other.depth ?? 1));
    max = Math.max(max, request.depth);
  }
  return max;
}

// Clicks the counter on a throttled network and records the requests until the update.
// "idle": the page loads, idles, then the network slows down before the click.
// "cold": the network is slow from the start and the click comes right after load.
async function waterfallRun(browser, base, { latency, idleMs, cold }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const throttle = () =>
    cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  if (cold) await throttle();
  await page.goto(`${base}/?n=3`, { waitUntil: 'load' });
  if (!cold) {
    await page.waitForLoadState('networkidle');
    await sleep(idleMs);
    await throttle();
  }
  const requests = new Map();
  let start = 0;
  page.on('request', (request) =>
    requests.set(request, {
      url: request.url().slice(base.length),
      start: performance.now() - start,
    }),
  );
  const finish = (request) => {
    const entry = requests.get(request);
    if (entry) entry.end = performance.now() - start;
  };
  page.on('requestfinished', finish);
  page.on('requestfailed', finish);
  start = performance.now();
  await INTERACTIONS.counter.run(page);
  let ms;
  try {
    await page.waitForFunction(INTERACTIONS.counter.done, null, { timeout: 30000, polling: 5 });
    ms = Math.round(performance.now() - start);
  } catch {
    ms = 'FAILED';
  }
  const list = [...requests.values()].filter((entry) => ms === 'FAILED' || entry.start <= ms);
  await context.close();
  return { ms, requests: list.length, roundTrips: roundTrips(list), log: list };
}

export async function measureWaterfall(browser, base, options) {
  return {
    idle: await waterfallRun(browser, base, { ...options, cold: false }),
    cold: await waterfallRun(browser, base, { ...options, cold: true }),
  };
}
