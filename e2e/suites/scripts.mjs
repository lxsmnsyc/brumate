// The production build of examples/external-scripts, under the strict content security policy of the
// other suites, with Trusted Types. The files of https://third-party.test are answered by the test,
// which reads the requests and the globals that the files set, so no step depends on a network.
import path from 'node:path';
import { assert, repo, serveBuild, watch, watchPolicy } from '../lib.mjs';

const root = path.join(repo, 'examples/external-scripts');
const TIMEOUT = 5000;
const SITE = 'https://third-party.test';

export const build = [['pnpm', ['--filter', 'example-external-scripts', 'build']]];

/** Serves the build as examples/external-scripts/server.prod.ts does, with a nonce for each page. */
export function start() {
  return serveBuild(root);
}

/** The code that each file of the other site holds. It adds its name to `window.loaded`. */
function body(file) {
  return `window.loaded = (window.loaded || []).concat(${JSON.stringify(file)});`;
}

export async function run({ browser, url, runner }) {
  const page = await browser.newPage();
  const errors = watch(page);
  watchPolicy(page, errors);
  const step = runner.flow('scripts', { page, errors });

  // The requests for the files of the other site, in order.
  const requests = [];
  await page.route(`${SITE}/**`, (route) => {
    const file = new URL(route.request().url()).pathname.slice(1);
    requests.push(file);
    return route.fulfill({
      contentType: 'text/javascript',
      headers: { 'cache-control': 'no-store' },
      body: body(file),
    });
  });
  const count = (file) => requests.filter((name) => name === file).length;
  const loaded = () => page.evaluate(() => window.loaded ?? []);
  const waitForFile = (file) =>
    page.waitForFunction((name) => (window.loaded ?? []).includes(name), file, {
      timeout: TIMEOUT,
    });
  // The times of the page events, to tell what the browser asked for before and after them.
  await page.addInitScript(() => {
    window.events = {};
    for (const type of ['DOMContentLoaded', 'load']) {
      window.addEventListener(type, () => (window.events[type] = performance.now()), true);
    }
  });

  await step(
    '/: a script without a trigger in #head is a script, with the others a template',
    async () => {
      const answer = await page.goto(`${url}/`);
      assert(
        answer.headers()['content-security-policy']?.includes("require-trusted-types-for 'script'"),
        'the page has no Trusted Types policy',
      );
      const html = await answer.text();
      assert(
        html.includes('<template src="https://third-party.test/idle.js" b-script="idle"'),
        'idle',
      );
      assert(
        !/<script[^>]* src="https:\/\/third-party\.test\/idle\.js"/.test(html),
        'idle is a script',
      );
      assert(
        /<script src="https:\/\/third-party\.test\/plain\.js" nonce="[^"]+"><\/script>/.test(html),
        'the script without a trigger is not an element with a nonce',
      );
      await waitForFile('plain.js');
    },
  );

  await step('/: idle loads the file after the page is idle', async () => {
    await waitForFile('idle.js');
    const times = await page.evaluate(() => ({
      ...window.events,
      idle: performance.getEntriesByName('https://third-party.test/idle.js')[0]?.startTime,
      plain: performance.getEntriesByName('https://third-party.test/plain.js')[0]?.startTime,
    }));
    assert(times.plain < times.DOMContentLoaded, 'the script without a trigger did not run first');
    assert(times.idle > times.DOMContentLoaded, `idle asked for the file at ${times.idle} ms`);
    assert(count('idle.js') === 1, 'idle.js was requested more than once');
  });

  await step(
    '/: an inline script runs once under the nonce, with its code as written',
    async () => {
      await page.waitForFunction(
        () => (window.loaded ?? []).some((name) => name.startsWith('inline-idle')),
        null,
        { timeout: TIMEOUT },
      );
      const inline = (await loaded()).filter((name) => name.startsWith('inline-idle'));
      assert(inline.length === 1, `the inline script ran ${inline.length} times`);
      assert(inline[0] === 'inline-idle <b>true</b>', `the inline script gave "${inline[0]}"`);
      const script = await page.evaluate(() => {
        const element = document.querySelector('head > script[data-name="inline-idle"]');
        return element && { nonce: element.nonce, text: element.textContent };
      });
      assert(script?.nonce, 'the script of the trigger has no nonce');
      assert(script.text.includes('1 < 2'), 'the code lost its text');
    },
  );

  await step('/: interaction and visible wait for the user', async () => {
    assert(count('interaction.js') === 0, 'interaction.js was requested before any input');
    assert(count('visible.js') === 0, 'visible.js was requested before it came into view');
    await page.keyboard.press('Shift');
    await waitForFile('interaction.js');
    assert(count('visible.js') === 0, 'visible.js was requested by a key');
    await page.locator('.end').scrollIntoViewIfNeeded();
    await waitForFile('visible.js');
    assert(count('visible.js') === 1, 'visible.js was requested more than once');
    assert(count('interaction.js') === 1, 'interaction.js was requested more than once');
    await page.evaluate(() => window.scrollTo(0, 0));
  });

  await step('/: blocks with the same src run it once', async () => {
    await page.click('.first');
    await page.waitForSelector('.first-block', { timeout: TIMEOUT });
    await waitForFile('block.js');
    // The inline script of a block that the browser renders keeps its code.
    await waitForFile('block-inline <i>true</i>');
    await page.click('.second');
    await page.waitForSelector('.second-block', { timeout: TIMEOUT });
    await page.waitForTimeout(300);
    assert(count('block.js') === 1, `block.js was requested ${count('block.js')} times`);
    assert(
      (await loaded()).filter((name) => name === 'block.js').length === 1,
      'block.js ran twice',
    );
  });

  await step('/two: a navigation keeps the scripts and runs only the new ones', async () => {
    await page.evaluate(() => (window.marker = 'kept'));
    await page.click('.to-two');
    await page.waitForSelector('.two', { timeout: TIMEOUT });
    await waitForFile('two.js');
    await waitForFile('rerun.js');
    assert((await page.evaluate(() => window.marker)) === 'kept', 'the page loaded again');
    await page.waitForTimeout(300);
    for (const file of ['plain.js', 'idle.js', 'block.js', 'two.js', 'rerun.js']) {
      assert(count(file) === 1, `${file} was requested ${count(file)} times`);
    }
  });

  await step(
    '/: going back and forward runs a script with data-rerun again, and no other',
    async () => {
      await page.click('.to-home');
      await page.waitForSelector('h1', { timeout: TIMEOUT });
      await page.waitForFunction(
        () => document.querySelector('h1').textContent === 'Scripts of other sites',
        null,
        {
          timeout: TIMEOUT,
        },
      );
      await page.click('.to-two');
      await page.waitForFunction(() => document.querySelector('.two'), null, { timeout: TIMEOUT });
      await page.waitForFunction(
        () => performance.getEntriesByName('https://third-party.test/rerun.js').length >= 2,
        null,
        { timeout: TIMEOUT },
      );
      assert(count('rerun.js') === 2, `rerun.js was requested ${count('rerun.js')} times`);
      for (const file of ['plain.js', 'idle.js', 'block.js', 'two.js']) {
        assert(
          count(file) === 1,
          `${file} was requested ${count(file)} times after a second visit`,
        );
      }
    },
  );

  await page.close();
}
