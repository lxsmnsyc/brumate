// The production build of examples/todos, under a strict content security
// policy: each page allows only scripts with its nonce, and the scripts they load.
import path from 'node:path';
import { assert, repo, serveBuild, watch, watchPolicy } from '../lib.mjs';

const root = path.join(repo, 'examples/todos');
const TIMEOUT = 5000;
// A title that closes a script, opens an HTML comment and holds U+2028.
// The state that the page inlines must escape all three.
const TRICKY = 'E2E </script><!-- \u2028 item';

export const build = [['pnpm', ['--filter', 'example-todos', 'build']]];

/** Serves the build as examples/todos/server.prod.ts does, with a nonce for each page. */
export function start() {
  return serveBuild(root);
}

const text = async (page, selector) => (await page.textContent(selector)).trim();

export async function run({ browser, url, runner }) {
  const page = await browser.newPage();
  const errors = watch(page);
  // A page without the nonce could not run its inline scripts, and Chrome says so as a warning.
  watchPolicy(page, errors);
  const step = runner.flow('todos', { page, errors });

  await step('/: the page loads under the CSP and the quote streams in', async () => {
    const answer = await page.goto(`${url}/`);
    assert(
      answer.headers()['content-security-policy']?.includes("'strict-dynamic'"),
      'the page has no CSP header',
    );
    await page.waitForSelector('blockquote', { timeout: TIMEOUT });
    const quote = await text(page, 'blockquote');
    assert(quote === 'Ship less code to the browser.', `the quote is "${quote}"`);
  });

  await step('/: toggling a todo updates the count', async () => {
    const before = await text(page, '.left');
    assert(before === '1 left', `the page starts with "${before}"`);
    await page.click('button.todo >> nth=1');
    await page.waitForFunction(
      () => document.querySelector('.left').textContent.trim() === '0 left',
      null,
      { timeout: TIMEOUT },
    );
    assert((await page.locator('li.done').count()) === 2, 'the toggled todo is not marked as done');
  });

  await step('/: adding a todo with </script><!-- and U+2028 in its title', async () => {
    await page.fill('input[aria-label="New todo"]', TRICKY);
    await page.click('main form button');
    await page.waitForFunction(
      (title) => [...document.querySelectorAll('button.todo')].some((b) => b.textContent === title),
      TRICKY,
      { timeout: TIMEOUT },
    );
    assert((await text(page, '.left')) === '1 left', 'the count did not include the new todo');
    assert(
      (await page.inputValue('input[aria-label="New todo"]')) === '',
      'the input was not cleared',
    );
  });

  await step('layout: the toggle keeps its state across a route change', async () => {
    await page.click('button.toggle');
    await page.waitForSelector('.page.wide', { timeout: TIMEOUT });
    await page.evaluate(() => (window.__e2eSamePage = true));
    await page.click('a[href^="/counter"]');
    await page.waitForURL('**/counter/10', { timeout: TIMEOUT });
    await page.waitForFunction(() => document.title === 'Counter', null, { timeout: TIMEOUT });
    assert(await page.evaluate(() => window.__e2eSamePage === true), 'the link loaded a new page');
    assert((await page.locator('.page.wide').count()) === 1, 'the layout lost its state');
    assert((await text(page, 'button.toggle')) === 'Narrow', 'the layout button lost its state');
  });

  await step('/counter/10: the counter counts after navigation', async () => {
    const button = page.locator('main button').first();
    const before = await button.textContent();
    await button.click();
    await page.waitForFunction(
      (previous) => document.querySelector('main button').textContent !== previous,
      before,
      { timeout: TIMEOUT },
    );
    const after = await button.textContent();
    assert(
      /11/.test(after) && /10/.test(before),
      `the counter went from "${before}" to "${after}"`,
    );
  });

  await step('/: back to the todos, the quote streams again and todos toggle', async () => {
    await page.click('nav a[href="/"]');
    await page.waitForURL(`${url}/`, { timeout: TIMEOUT });
    await page.waitForSelector('blockquote', { timeout: TIMEOUT });
    const before = await text(page, '.left');
    await page.click('button.todo >> nth=1');
    await page.waitForFunction(
      (previous) => document.querySelector('.left').textContent.trim() !== previous,
      before,
      { timeout: TIMEOUT },
    );
    assert(await page.evaluate(() => window.__e2eSamePage === true), 'the link loaded a new page');
  });

  await step('/guestbook: signing calls the server function and refreshes the list', async () => {
    await page.click('a[href="/guestbook"]');
    await page.waitForURL('**/guestbook', { timeout: TIMEOUT });
    const name = `Ada ${Date.now()}`;
    await page.fill('input[name=name]', name);
    await page.click('main form button');
    await page.locator('main li', { hasText: name }).waitFor({ timeout: TIMEOUT });
    await page.locator('p.signed').waitFor({ timeout: TIMEOUT });
    assert(await page.evaluate(() => window.__e2eSamePage === true), 'the form loaded a new page');
    await page.fill('input[name=name]', '');
    await page.click('main form button');
    await page.locator('p.error', { hasText: 'Enter a name' }).waitFor({ timeout: TIMEOUT });
  });
  await page.close();

  // A link clicked before the core loads: the loader keeps the click and navigates.
  const fresh = await browser.newPage();
  const freshErrors = watch(fresh);
  const early = runner.flow('todos', { page: fresh, errors: freshErrors });
  await early('/: navigating before the core loads, then counting', async () => {
    await fresh.goto(`${url}/`, { waitUntil: 'commit' });
    await fresh.click('a[href^="/counter"]');
    await fresh.waitForFunction(() => document.title === 'Counter', null, { timeout: TIMEOUT });
    const button = fresh.locator('main button').first();
    const before = await button.textContent();
    await button.click();
    await fresh.waitForFunction(
      (previous) => document.querySelector('main button').textContent !== previous,
      before,
      { timeout: TIMEOUT },
    );
  });
  await early('/counter/10: the layout toggle works after that navigation', async () => {
    await fresh.click('button.toggle');
    await fresh.waitForSelector('.page.wide', { timeout: TIMEOUT });
  });
  await fresh.close();
}
