// The browser metrics of the rows scenario. Each operation is timed from a Chrome trace: from
// the start of the click event to the end of the last paint after it, as js-framework-benchmark
// does. The page is not throttled unless `cpu` is above 1.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const median = (values) => {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const round = (value) => Math.round(value * 10) / 10;

const CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'toplevel',
  'v8.execute',
  'blink.user_timing',
];

// What the page shows now, which the checks compare with what it showed before a click.
function snapshot(page) {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('tbody tr');
    const id = (row) => row?.cells[0].textContent.trim();
    return {
      count: rows.length,
      first: id(rows[0]),
      second: id(rows[1]),
      last: id(rows[998]),
      label: rows[0]?.cells[1].textContent.trim(),
    };
  });
}

// Waits until `done(now, before)` holds in the page, then for two frames, so the paint of the
// change is in the trace.
async function waitDone(page, done, before) {
  await page.waitForFunction(
    ([source, previous]) => {
      const rows = document.querySelectorAll('tbody tr');
      const id = (row) => row?.cells[0].textContent.trim();
      const now = {
        count: rows.length,
        first: id(rows[0]),
        second: id(rows[1]),
        last: id(rows[998]),
        label: rows[0]?.cells[1].textContent.trim(),
        selected: rows[1]?.className,
      };
      return new Function('now', 'before', `return (${source})(now, before)`)(now, previous);
    },
    [done.toString(), before],
    { timeout: 30_000 },
  );
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

// The checks run in the page from their source, so a check that needs a number has it in its
// source.
const created = (count) =>
  // oxlint-disable-next-line no-new-func
  new Function('now', 'before', `return now.count === ${count} && now.first !== before.first;`);
const run = (page) => clickAndWait(page, '#run', created(1000));
const repeat = async (times, step) => {
  for (let index = 0; index < times; index++) await step(index);
};

// The operations of js-framework-benchmark, each with its own warmup on a page that loaded with
// no rows: the same click a few times before the click that the trace measures.
export const OPERATIONS = {
  create1k: {
    label: 'Create 1,000 rows',
    setup: (page) =>
      repeat(5, async () => {
        await run(page);
        await clickAndWait(page, '#clear', (now) => now.count === 0);
      }),
    click: '#run',
    done: created(1000),
  },
  replace1k: {
    label: 'Replace 1,000 rows',
    setup: (page) => repeat(5, () => run(page)),
    click: '#run',
    done: created(1000),
  },
  update10th: {
    label: 'Update every 10th of 1,000 rows',
    setup: async (page) => {
      await run(page);
      await repeat(3, () =>
        clickAndWait(page, '#update', (now, before) => now.label === `${before.label} !!!`),
      );
    },
    click: '#update',
    done: (now, before) => now.label === `${before.label} !!!`,
  },
  select: {
    label: 'Select a row of 1,000',
    setup: async (page) => {
      await run(page);
      await repeat(5, async (index) => {
        await page.click(`tbody tr:nth-child(${index + 5}) a.lbl`);
        await page.waitForFunction(
          (row) => document.querySelector(`tbody tr:nth-child(${row})`).className === 'danger',
          index + 5,
        );
      });
    },
    click: 'tbody tr:nth-child(2) a.lbl',
    done: (now) => now.selected === 'danger',
  },
  swap: {
    label: 'Swap 2 of 1,000 rows',
    setup: async (page) => {
      await run(page);
      await repeat(5, () =>
        clickAndWait(page, '#swaprows', (now, before) => now.second === before.last),
      );
    },
    click: '#swaprows',
    done: (now, before) => now.second === before.last && now.last === before.second,
  },
  remove: {
    label: 'Remove a row of 1,000',
    setup: async (page) => {
      await run(page);
      await repeat(5, (index) =>
        clickAndWait(
          page,
          `tbody tr:nth-child(${9 - index}) a.remove`,
          (now, before) => now.count === before.count - 1,
        ),
      );
    },
    click: 'tbody tr:nth-child(4) a.remove',
    done: (now, before) => now.count === before.count - 1,
  },
  create10k: {
    label: 'Create 10,000 rows',
    setup: (page) =>
      repeat(5, async () => {
        await run(page);
        await clickAndWait(page, '#clear', (now) => now.count === 0);
      }),
    click: '#runlots',
    done: created(10000),
  },
  append1k: {
    label: 'Append 1,000 rows to 1,000',
    setup: async (page) => {
      await OPERATIONS.create1k.setup(page);
      await run(page);
    },
    click: '#add',
    done: (now) => now.count === 2000,
  },
  clear: {
    label: 'Clear 1,000 rows',
    setup: async (page) => {
      await OPERATIONS.create1k.setup(page);
      await run(page);
    },
    click: '#clear',
    done: (now) => now.count === 0,
  },
};

// The first click on a page that the server rendered with 1,000 rows, after the idle wait.
export const RESUMED = {
  select: {
    label: 'Select a row',
    click: 'tbody tr:nth-child(2) a.lbl',
    done: OPERATIONS.select.done,
  },
  update10th: {
    label: 'Update every 10th row',
    click: '#update',
    done: OPERATIONS.update10th.done,
  },
  remove: {
    label: 'Remove a row',
    click: 'tbody tr:nth-child(4) a.remove',
    done: OPERATIONS.remove.done,
  },
};

async function trace(browser, page, action) {
  await browser.startTracing(page, { categories: CATEGORIES });
  let failure;
  try {
    await action();
  } catch (error) {
    failure = error;
  }
  const buffer = await browser.stopTracing();
  if (failure) throw failure;
  return JSON.parse(buffer.toString('utf8')).traceEvents;
}

// The tasks of the main thread of a renderer. Chrome writes one of two names, by version, and
// each task counts once.
function tasksOf(events, pid, tid) {
  const tasks = events.filter(
    (event) =>
      event.pid === pid &&
      event.tid === tid &&
      event.ph === 'X' &&
      (event.name === 'RunTask' || event.name === 'ThreadControllerImpl::RunTask'),
  );
  const name = tasks.some((task) => task.name === 'RunTask')
    ? 'RunTask'
    : 'ThreadControllerImpl::RunTask';
  return tasks.filter((task) => task.name === name);
}

// From the start of the click to the end of the last paint in the same renderer after it:
// `paint` is the time that passed, and `cpu` the time that the main thread spent in tasks. A
// paint waits for the next frame, so `paint` moves in steps of about 16 ms, and `cpu` does not.
function clickToPaint(events) {
  const click = events.find(
    (event) => event.name === 'EventDispatch' && event.args?.data?.type === 'click',
  );
  if (!click) throw new Error('the trace has no click');
  let end = click.ts + (click.dur ?? 0);
  for (const event of events) {
    if (event.pid !== click.pid || event.ts < click.ts) continue;
    if (event.name === 'Paint' || event.name === 'Commit')
      end = Math.max(end, event.ts + (event.dur ?? 0));
  }
  // Only the part of each task between the click and the paint counts.
  const cpu = tasksOf(events, click.pid, click.tid).reduce(
    (sum, task) =>
      sum + Math.max(0, Math.min(end, task.ts + task.dur) - Math.max(click.ts, task.ts)),
    0,
  );
  return { paint: (end - click.ts) / 1000, cpu: cpu / 1000 };
}

// The time that the main thread of the page spent in tasks, and the longest task.
function mainThread(events, base) {
  const parse = events.find(
    (event) => event.name === 'ParseHTML' && event.args?.beginData?.url?.startsWith(base),
  );
  if (!parse) throw new Error('the trace has no parse of the page');
  const durations = tasksOf(events, parse.pid, parse.tid).map((task) => task.dur / 1000);
  return {
    busy: durations.reduce((sum, value) => sum + value, 0),
    longest: Math.max(0, ...durations),
  };
}

async function heap(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  await cdp.detach();
  return usedSize;
}

async function throttle(page, cpu) {
  if (cpu <= 1) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
}

async function clickAndWait(page, selector, done) {
  const before = await snapshot(page);
  await page.click(selector);
  await waitDone(page, done, before);
}

const summary = (samples) => ({
  median: round(median(samples)),
  min: round(Math.min(...samples)),
  max: round(Math.max(...samples)),
  samples: samples.map(round),
});

const timings = (samples) => ({
  cpu: summary(samples.map((sample) => sample.cpu)),
  paint: summary(samples.map((sample) => sample.paint)),
});

// Runs each operation `runs` times, each on a new page.
export async function measureRows(browser, base, { runs, cpu, idleMs }) {
  const errors = [];
  const failed = [];
  const operations = {};
  const watch = (page) => page.on('pageerror', (error) => errors.push(error.message));

  for (const [key, operation] of Object.entries(OPERATIONS)) {
    const samples = [];
    for (let attempt = 0; attempt < runs; attempt++) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await context.newPage();
      watch(page);
      try {
        await page.goto(`${base}/?n=0`, { waitUntil: 'networkidle' });
        await operation.setup(page);
        await throttle(page, cpu);
        const before = await snapshot(page);
        const events = await trace(browser, page, async () => {
          await page.click(operation.click);
          await waitDone(page, operation.done, before);
        });
        samples.push(clickToPaint(events));
      } catch (error) {
        failed.push(`${key}: ${error.message.split('\n')[0]}`);
        break;
      } finally {
        await context.close();
      }
    }
    if (samples.length) operations[key] = timings(samples);
  }

  // The heap after the page made 1,000 rows, with no rows from the server.
  const created1k = [];
  for (let attempt = 0; attempt < Math.min(runs, 3); attempt++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${base}/?n=0`, { waitUntil: 'networkidle' });
      await clickAndWait(page, '#run', created(1000));
      await sleep(idleMs);
      created1k.push(await heap(page));
    } catch (error) {
      failed.push(`heap: ${error.message.split('\n')[0]}`);
    } finally {
      await context.close();
    }
  }

  // The page that the server rendered with 1,000 rows: the work of the main thread while it
  // loads and idles, its heap, and the first click of each kind.
  const resumed = {};
  const load = { busy: [], longest: [], heap: [] };
  for (const [key, operation] of Object.entries(RESUMED)) {
    const samples = [];
    for (let attempt = 0; attempt < runs; attempt++) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await context.newPage();
      watch(page);
      try {
        const loading = await trace(browser, page, async () => {
          await page.goto(`${base}/?n=1000`, { waitUntil: 'networkidle' });
          await sleep(idleMs);
        });
        if (key === 'select') {
          const thread = mainThread(loading, base);
          load.busy.push(thread.busy);
          load.longest.push(thread.longest);
          load.heap.push(await heap(page));
        }
        await throttle(page, cpu);
        const before = await snapshot(page);
        const events = await trace(browser, page, async () => {
          await page.click(operation.click);
          await waitDone(page, operation.done, before);
        });
        samples.push(clickToPaint(events));
      } catch (error) {
        failed.push(`resumed ${key}: ${error.message.split('\n')[0]}`);
        break;
      } finally {
        await context.close();
      }
    }
    if (samples.length) resumed[key] = timings(samples);
  }

  return {
    operations,
    resumed,
    load: load.busy.length
      ? {
          busy: summary(load.busy),
          longest: summary(load.longest),
          heap: Math.round(median(load.heap)),
        }
      : undefined,
    heapCreated: created1k.length ? Math.round(median(created1k)) : undefined,
    errors: [...new Set(errors)],
    failed,
  };
}
