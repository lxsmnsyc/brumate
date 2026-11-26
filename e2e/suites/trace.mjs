// The production build of examples/trace, which passes `onTrace` to the loader and exports it from
// its middleware. The spans of the browser are in `window.spans`, those of the server in
// `globalThis.serverSpans` of this process, which runs the server.
import path from 'node:path';
import { assert, freePort, repo, serveBuild, startProcess, watch, watchPolicy } from '../lib.mjs';

const root = path.join(repo, 'examples/trace');
const TIMEOUT = 5000;

export const build = [['pnpm', ['--filter', 'example-trace', 'build']]];

export function start() {
  return serveBuild(root);
}

const browserSpans = (page, name) =>
  page.evaluate((wanted) => window.spans.filter((span) => span.name === wanted), name);
const serverSpans = (name) => (globalThis.serverSpans ?? []).filter((span) => span.name === name);

async function waitForSpans(page, name, count) {
  await page.waitForFunction(
    ([wanted, times]) => window.spans.filter((span) => span.name === wanted).length >= times,
    [name, count],
    { timeout: TIMEOUT },
  );
}

export async function run({ browser, url, runner }) {
  const page = await browser.newPage();
  const errors = watch(page);
  watchPolicy(page, errors);
  const step = runner.flow('trace', { page, errors });

  await step('/: a click before the code loads gives event > load + run, then fetch', async () => {
    // Held back, so the click comes before the code of the page.
    await page.route('**/Index_*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    });
    await page.goto(`${url}/`);
    await page.click('button.save');
    await waitForSpans(page, 'brumate.event', 1);
    await waitForSpans(page, 'brumate.fetch', 1);
    const spans = await page.evaluate(() => window.spans);
    const event = spans.find((span) => span.name === 'brumate.event');
    const load = spans.find((span) => span.name === 'brumate.load');
    const handlerSpan = spans.find((span) => span.name === 'brumate.run');
    assert(event && load && handlerSpan, `the spans are ${spans.map((span) => span.name)}`);
    assert(event.label.startsWith('click '), `the event label is "${event.label}"`);
    assert(
      load.parentId === event.spanId && handlerSpan.parentId === event.spanId,
      'load and run are not children of the event',
    );
    assert(
      load.traceId === event.traceId && handlerSpan.traceId === event.traceId,
      'the trace differs',
    );
    assert(load.end <= handlerSpan.start + 1, 'the handler ran before its code loaded');
    assert(load.end - load.start >= 50, `the load took ${load.end - load.start} ms`);
    assert(event.start <= load.start + 1, 'the event did not start at the listener');
  });

  await step('/: the server span of the call has the fetch span as its parent', async () => {
    const [fetchSpan] = await browserSpans(page, 'brumate.fetch');
    const [handlerSpan] = await browserSpans(page, 'brumate.run');
    assert(fetchSpan.parentId === handlerSpan.spanId, 'the fetch is not a child of the run');
    assert(fetchSpan.attributes['http.status_code'] === 200, 'the call did not answer 200');
    await page.waitForFunction(
      () => document.querySelector('button.save').textContent.includes('4'),
      null,
      { timeout: TIMEOUT },
    );
    const request = serverSpans('brumate.request').find(
      (span) => span.parentId === fetchSpan.spanId,
    );
    assert(request, 'no server request has the fetch span as its parent');
    assert(request.traceId === fetchSpan.traceId, 'the server span is in another trace');
    assert(
      request.attributes['brumate.kind'] === 'call',
      `the kind is ${request.attributes['brumate.kind']}`,
    );
    const text = JSON.stringify(await page.evaluate(() => window.spans));
    assert(!text.includes('milk'), 'the argument of the call is in a span');
  });

  await step('/: a second click needs no load', async () => {
    await page.click('button.save');
    await waitForSpans(page, 'brumate.event', 2);
    assert((await browserSpans(page, 'brumate.load')).length === 1, 'a second load span was made');
  });

  await step('/: an error in a handler gives error spans', async () => {
    await page.click('button.fail');
    await waitForSpans(page, 'brumate.event', 3);
    const events = await browserSpans(page, 'brumate.event');
    const failed = events.find((span) => span.status === 'error');
    assert(failed?.error?.message === 'broken handler', 'the event has no error');
    // The error of the handler is logged by the page, as without tracing.
    errors.length = 0;
  });

  await step(
    '/: a link gives brumate.navigation with the route, and the server joins it',
    async () => {
      await page.evaluate(() => (window.__samePage = true));
      // Rest on the link past the 80 ms of an early load: a traced page must not load it early.
      const early = [];
      function listen(request) {
        if (request.url().includes('/items/')) {
          early.push(request.url());
        }
      }
      page.on('request', listen);
      await page.hover('a.item');
      await page.waitForTimeout(300);
      page.off('request', listen);
      assert(early.length === 0, 'the traced page loaded the link early');
      await page.click('a.item');
      await page.waitForSelector('.item-page', { timeout: TIMEOUT });
      await waitForSpans(page, 'brumate.navigation', 1);
      assert(await page.evaluate(() => window.__samePage === true), 'the link loaded a new page');
      const [navigation] = await browserSpans(page, 'brumate.navigation');
      assert(
        navigation.attributes['http.route'] === '/items/[id]' &&
          navigation.label === 'GET /items/[id]',
        `the route is ${navigation.attributes['http.route']}`,
      );
      assert(navigation.attributes['http.status_code'] === 200, 'the status is missing');
      assert(!JSON.stringify(navigation).includes('secret'), 'the query string is in the span');
      // The server ends its span when the response ends, which can be after the page showed it.
      const deadline = Date.now() + TIMEOUT;
      let request;
      while (Date.now() < deadline) {
        request = serverSpans('brumate.request').find(
          (span) => span.parentId === navigation.spanId,
        );
        if (request) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert(
        request && request.traceId === navigation.traceId,
        'the server request is not in the trace of the navigation',
      );
    },
  );

  await step('/items/7: a navigation that fails has no path in its span', async () => {
    // The server is down for this page: the answer has no state of a route.
    await page.route('**/items/9*', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'text/html',
        body: '<html><body>down</body></html>',
      }),
    );
    await page.evaluate(() =>
      document.dispatchEvent(
        new CustomEvent('brumate:navigate', {
          detail: { url: '/items/9?secret=2', replace: false, scroll: true, done() {} },
          cancelable: true,
        }),
      ),
    );
    await waitForSpans(page, 'brumate.navigation', 2);
    const [, failed] = await browserSpans(page, 'brumate.navigation');
    assert(failed.status === 'error', 'a 503 is not an error span');
    assert(failed.label === 'GET', `the label is "${failed.label}"`);
    assert(failed.attributes['http.route'] === undefined, 'the route is in the span');
    const text = JSON.stringify(failed);
    assert(!text.includes('items/9') && !text.includes('secret'), 'the path is in the span');
    // The browser logs the 503 itself.
    errors.length = 0;
  });

  await step('/ under vite dev: the client entry of the app runs', async () => {
    const port = await freePort();
    const dev = `http://localhost:${port}`;
    const stop = await startProcess(
      process.execPath,
      [path.join(root, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort'],
      { cwd: root, url: dev },
    );
    const devPage = await browser.newPage();
    const devErrors = watch(devPage);
    try {
      await devPage.goto(`${dev}/`, { waitUntil: 'load' });
      // `window.spans` is set by src/client.ts, not by the start module.
      await devPage.waitForFunction(() => Array.isArray(window.spans), null, {
        timeout: TIMEOUT,
      });
      assert(devErrors.length === 0, devErrors.join('\n'));
    } finally {
      await devPage.close();
      await stop();
    }
  });

  const failures = errors.filter((error) => !error.includes('broken handler'));
  assert(failures.length === 0, failures.join('\n'));
  await page.close();
}
