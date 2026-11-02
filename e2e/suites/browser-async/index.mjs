// The production build of examples/browser-async. Each block opens in the browser, and the
// test settles its promises from the page (window.gates), so no step depends on timing.
import path from 'node:path';
import { assert, repo, serveBuild, watch, watchPolicy } from '../../lib.mjs';

const root = path.join(repo, 'examples/browser-async');
const TIMEOUT = 5000;

export const build = [['pnpm', ['--filter', 'example-browser-async', 'build']]];

/** Serves the build as examples/browser-async/server.prod.ts does, with a nonce for each page. */
export function start() {
  return serveBuild(root);
}

const count = (page, selector) => page.locator(selector).count();
const text = async (page, selector) => (await page.textContent(selector)).trim();

/** Waits until the page holds `times` unsettled promises of `name`. */
function pending(page, name, times = 1) {
  return page.waitForFunction(
    ([key, expected]) => window.gates.pending(key) === expected,
    [name, times],
    { timeout: TIMEOUT },
  );
}

const settle = (page, name, value) =>
  page.evaluate(([key, answer]) => window.gates.settle(key, answer), [name, value]);
const reject = (page, name, message) =>
  page.evaluate(([key, error]) => window.gates.reject(key, error), [name, message]);

export async function run({ browser, url, runner }) {
  const page = await browser.newPage();
  const errors = watch(page);
  watchPolicy(page, errors);
  const step = runner.flow('browser-async', { page, errors });

  await step('/: the page loads with nothing open', async () => {
    await page.goto(`${url}/`);
    await page.waitForSelector('.outside-block', { timeout: TIMEOUT });
    await page.waitForFunction(() => typeof window.gates === 'object', null, {
      timeout: TIMEOUT,
    });
    assert((await text(page, '.root-old')) === 'old content', 'the root block is not there');
    assert(
      (await count(page, '.branch-fallback')) === 0,
      'a fallback shows before its block opens',
    );
  });

  await step(
    '#if: a branch shows its fallback, then the memo and the promise in text',
    async () => {
      await page.click('.branch-open');
      await page.waitForSelector('.branch-fallback', { timeout: TIMEOUT });
      await pending(page, 'branch-memo');
      assert((await count(page, '.branch-memo')) === 0, 'the body shows before the memo settles');
      assert((await text(page, '.outside-block')) === 'outside', 'the block outside went away');

      // The memo alone does not end the wait: the promise in text holds the fallback.
      await settle(page, 'branch-memo', 'ada');
      await pending(page, 'branch-text');
      assert((await count(page, '.branch-fallback')) === 1, 'the fallback left before the text');
      assert((await count(page, '.branch-memo')) === 0, 'the body shows before the text settles');

      await settle(page, 'branch-text', 'hello');
      await page.waitForSelector('.branch-memo', { timeout: TIMEOUT });
      assert((await text(page, '.branch-memo')) === 'ada', 'the memo value is not in the body');
      assert((await text(page, '.branch-text')) === 'hello', 'the promise in text did not render');
      assert((await count(page, '.branch-fallback')) === 0, 'the fallback stays after the body');
    },
  );

  await step('#for: rows show a fallback each and settle out of order', async () => {
    await page.click('.rows-add');
    await page.click('.rows-add');
    await page.waitForFunction(
      () => document.querySelectorAll('.row-fallback').length === 2,
      null,
      {
        timeout: TIMEOUT,
      },
    );
    await pending(page, 'row-memo-1');
    await pending(page, 'row-memo-2');

    // The second row settles first. The first keeps its fallback.
    await settle(page, 'row-memo-2', 'grace');
    await pending(page, 'row-text-2');
    await settle(page, 'row-text-2', 'two');
    await page.waitForFunction(() => document.querySelectorAll('.row-memo').length === 1, null, {
      timeout: TIMEOUT,
    });
    const rows = page.locator('li.row');
    assert((await rows.nth(0).locator('.row-fallback').count()) === 1, 'row 1 lost its fallback');
    assert((await rows.nth(1).locator('.row-memo').textContent()) === 'grace', 'row 2 memo');
    assert((await rows.nth(1).locator('.row-text').textContent()) === 'two', 'row 2 text');

    await settle(page, 'row-memo-1', 'linus');
    await pending(page, 'row-text-1');
    await settle(page, 'row-text-1', 'one');
    await page.waitForFunction(
      () => document.querySelectorAll('.row-fallback').length === 0,
      null,
      {
        timeout: TIMEOUT,
      },
    );
    assert((await rows.nth(0).locator('.row-memo').textContent()) === 'linus', 'row 1 memo');
    assert((await rows.nth(0).locator('.row-text').textContent()) === 'one', 'row 1 text');
  });

  await step('root boundary: a block outside every #loading keeps what it shows', async () => {
    await page.click('.root-open');
    await pending(page, 'root-memo');
    // The server would hold the page here. The browser keeps the old block.
    assert((await text(page, '.root-old')) === 'old content', 'the old block went away');
    assert((await count(page, '.root-value')) === 0, 'the new block shows before its memo');
    assert((await text(page, '.outside-block')) === 'outside', 'the block outside went away');
    await settle(page, 'root-memo', 'ready');
    await page.waitForSelector('.root-value', { timeout: TIMEOUT });
    assert((await text(page, '.root-value')) === 'ready', 'the new block has no value');
    assert((await count(page, '.root-old')) === 0, 'the old block stays after the swap');
  });

  await step('#loading (memo): the fallback shows again and the same DOM comes back', async () => {
    await page.click('.doc-open');
    await page.waitForSelector('.doc-fallback', { timeout: TIMEOUT });
    await settle(page, 'doc-1', 'first');
    await page.waitForSelector('.doc-value', { timeout: TIMEOUT });
    assert((await text(page, '.doc-value')) === 'first', 'the first value is missing');

    // Mark the nodes and type in the field, to tell them from new ones later.
    await page.fill('.doc-field', 'typed');
    await page.evaluate(() => {
      document.querySelector('.doc-value').dataset.mark = 'same';
      document.querySelector('.doc-field').dataset.mark = 'same';
    });

    await page.click('.doc-next');
    await page.waitForSelector('.doc-fallback', { timeout: TIMEOUT });
    await pending(page, 'doc-2');
    assert(
      (await page.locator('.doc-value').isHidden()) || (await count(page, '.doc-value')) === 0,
      'the body shows while its memo loads',
    );

    await settle(page, 'doc-2', 'second');
    await page.waitForFunction(
      () => document.querySelectorAll('.doc-fallback').length === 0,
      null,
      {
        timeout: TIMEOUT,
      },
    );
    const value = page.locator('.doc-value');
    assert((await value.textContent()) === 'second', 'the new value is missing');
    assert(await value.isVisible(), 'the body is hidden after the load');
    assert((await value.getAttribute('data-mark')) === 'same', 'the text is a new node');
    assert(
      (await page.locator('.doc-field').getAttribute('data-mark')) === 'same',
      'the input is a new node',
    );
    assert((await page.inputValue('.doc-field')) === 'typed', 'the input lost its value');
  });

  await step('#try: a rejected wait reaches the #catch', async () => {
    await page.click('.try-open');
    await pending(page, 'try-memo');
    assert((await count(page, '.try-caught')) === 0, 'the catch shows before the rejection');
    await reject(page, 'try-memo', 'no user');
    await page.waitForSelector('.try-caught', { timeout: TIMEOUT });
    const caught = await text(page, '.try-caught');
    assert(caught.includes('no user'), `the catch shows "${caught}"`);
    assert((await count(page, '.try-value')) === 0, 'the body shows after a rejection');
  });

  await page.close();
}
