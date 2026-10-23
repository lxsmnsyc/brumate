// The production build of examples/tracker, under the same strict content
// security policy as the todos suite. /about is a prerendered file.
import path from 'node:path';
import { assert, repo, serveBuild, watch, watchPolicy } from '../lib.mjs';

const root = path.join(repo, 'examples/tracker');
const TIMEOUT = 5000;

export const build = [['pnpm', ['--filter', 'example-tracker', 'build']]];

export function start() {
  return serveBuild(root);
}

const titles = (page) =>
  page.$$eval('.issues li a', (links) => links.map((link) => link.textContent.trim()));

/** Holds server function calls back for a moment, so a guess shows before the answer. */
async function slowCalls(page, ms = 600) {
  await page.route('**/_brumate/**', async (route) => {
    await new Promise((done) => setTimeout(done, ms));
    await route.continue();
  });
  return () => page.unroute('**/_brumate/**');
}

export async function run({ browser, url, runner }) {
  const page = await browser.newPage();
  const errors = watch(page);
  watchPolicy(page, errors);
  const step = runner.flow('tracker', { page, errors });

  await step('/: the list renders under the CSP and the activity streams in', async () => {
    const answer = await page.goto(`${url}/`);
    assert(
      answer.headers()['content-security-policy']?.includes("'strict-dynamic'"),
      'the page has no CSP header',
    );
    const shown = await titles(page);
    assert(shown.length === 3, `the list shows ${shown.length} issues: ${shown.join(', ')}`);
    await page.locator('.feed li').first().waitFor({ timeout: TIMEOUT });
  });

  await step('/: the search and the status filter the list', async () => {
    await page.fill('input[type=search]', 'theme');
    await page.waitForFunction(() => document.querySelectorAll('.issues li a').length === 1, null, {
      timeout: TIMEOUT,
    });
    assert((await titles(page))[0] === 'Add a dark theme', 'the search kept the wrong issue');
    await page.fill('input[type=search]', '');
    await page.selectOption('select[name=status]', 'closed');
    await page.waitForFunction(
      () => document.querySelector('.issues li a')?.textContent === 'Links break on phones',
      null,
      { timeout: TIMEOUT },
    );
    await page.selectOption('select[name=status]', 'open');
    await page.waitForFunction(() => document.querySelectorAll('.issues li a').length === 3, null, {
      timeout: TIMEOUT,
    });
  });

  await step('/: a star shows before the server answers, and stays', async () => {
    const star = page.locator('button[aria-label="Star #2"]');
    assert((await star.getAttribute('aria-pressed')) === 'false', '#2 starts with a star');
    const restore = await slowCalls(page);
    await star.click();
    // The call takes 600 ms, so a star within 400 ms is the guess.
    await page.waitForFunction(
      () =>
        document.querySelector('button[aria-label="Star #2"]').getAttribute('aria-pressed') ===
        'true',
      null,
      { timeout: 400 },
    );
    await page.waitForResponse('**/_brumate/**', { timeout: TIMEOUT });
    await restore();
    await page.waitForTimeout(300);
    assert((await star.getAttribute('aria-pressed')) === 'true', 'the star went away');
  });

  await step('/: a link after the star sends no server calls', async () => {
    const calls = [];
    const onRequest = (request) => {
      if (new URL(request.url()).pathname.startsWith('/_brumate/')) {
        calls.push(request.url());
      }
    };
    page.on('request', onRequest);
    await page.click('.issues a:has-text("Add a dark theme")');
    await page.waitForURL('**/issues/2', { timeout: TIMEOUT });
    await page.locator('h1', { hasText: 'Add a dark theme' }).waitFor({ timeout: TIMEOUT });
    await page.waitForTimeout(500);
    page.off('request', onRequest);
    assert(calls.length === 0, `the page called the server: ${calls.join(', ')}`);
    await page.goBack();
    await page.waitForURL(`${url}/`, { timeout: TIMEOUT });
    await page.locator('.issues li a').first().waitFor({ timeout: TIMEOUT });
  });

  await step('/issues/new: signed out, the middleware sends the link to sign in', async () => {
    await page.evaluate(() => (window.__e2eSamePage = true));
    await page.click('nav a[href="/issues/new"]');
    await page.waitForURL('**/sign-in?next=%2Fissues%2Fnew', { timeout: TIMEOUT });
    await page.locator('h1', { hasText: 'Sign in' }).waitFor({ timeout: TIMEOUT });
    assert(await page.evaluate(() => window.__e2eSamePage === true), 'the link loaded a new page');
  });

  await step('/sign-in: a short name shows an error, then signing in goes back', async () => {
    await page.fill('input[name=name]', 'A');
    await page.click('main form button');
    await page.locator('p.error', { hasText: 'Use 2 to 30 letters' }).waitFor({ timeout: TIMEOUT });
    await page.fill('input[name=name]', 'Ada');
    // The redirect of an $action loads the page on the client, and the layout shows the user.
    await page.evaluate(() => (window.__e2eSamePage = true));
    await page.click('main form button');
    await page.waitForURL('**/issues/new', { timeout: TIMEOUT });
    await page.locator('header .user span', { hasText: 'Ada' }).waitFor({ timeout: TIMEOUT });
    assert(
      await page.evaluate(() => window.__e2eSamePage === true),
      'signing in loaded a new page',
    );
  });

  await step('/issues/new: a short title shows an error, then the issue opens', async () => {
    await page.fill('input[name=title]', 'No');
    await page.click('main form button');
    await page
      .locator('p.error', { hasText: 'Write a title of at least 3 characters' })
      .waitFor({ timeout: TIMEOUT });
    await page.fill('input[name=title]', 'Export issues as CSV');
    await page.fill('textarea[name=body]', 'For a spreadsheet.');
    await page.check('input[value=feature]');
    await page.evaluate(() => (window.__e2eSamePage = true));
    await page.click('main form button');
    // The redirect of an $action loads the new page on the client.
    await page.waitForURL('**/issues/5', { timeout: TIMEOUT });
    await page.locator('h1', { hasText: 'Export issues as CSV' }).waitFor({ timeout: TIMEOUT });
    assert((await page.textContent('.meta')).includes('You opened it'), 'the author is not you');
    assert(
      await page.evaluate(() => window.__e2eSamePage === true),
      'the redirect loaded a new page',
    );
  });

  await step('/issues/5: closing shows before the server answers', async () => {
    const restore = await slowCalls(page);
    await page.click('button:has-text("Close issue")');
    await page.waitForFunction(
      () => document.querySelector('.meta .state')?.textContent === 'Closed',
      null,
      { timeout: 400 },
    );
    await page.waitForResponse('**/_brumate/**', { timeout: TIMEOUT });
    await restore();
    await page.locator('button:has-text("Reopen issue")').waitFor({ timeout: TIMEOUT });
    await page.waitForTimeout(300);
    assert((await page.textContent('.meta .state')) === 'Closed', 'the issue opened again');
  });

  await step('/issues/5: the dialog asks before deleting, and Esc closes it', async () => {
    await page.click('.actions button.danger');
    const dialog = page.locator('[role=dialog]');
    await dialog.waitFor({ timeout: TIMEOUT });
    await page.waitForFunction(() => document.activeElement?.textContent === 'Cancel', null, {
      timeout: TIMEOUT,
    });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached', timeout: TIMEOUT });
    await page.click('.actions button.danger');
    // A form without $action that redirects navigates like a link.
    await page.evaluate(() => (window.__e2eSamePage = true));
    await dialog.locator('button.danger').click();
    await page.waitForURL(`${url}/`, { timeout: TIMEOUT });
    await page.selectOption('select[name=status]', 'all');
    await page.waitForFunction(() => document.querySelectorAll('.issues li a').length === 4, null, {
      timeout: TIMEOUT,
    });
    assert(!(await titles(page)).includes('Export issues as CSV'), 'the issue is still listed');
  });

  await step('/issues/3: a related issue that is gone shows the #catch', async () => {
    await page.click('.issues a:has-text("Document the keyboard shortcuts")');
    await page.waitForURL('**/issues/3', { timeout: TIMEOUT });
    await page
      .locator('.related a', { hasText: '#2 Add a dark theme' })
      .waitFor({ timeout: TIMEOUT });
    await page
      .locator('.related .gone', { hasText: '#9 was deleted' })
      .waitFor({ timeout: TIMEOUT });
    assert(await page.evaluate(() => window.__e2eSamePage === true), 'the link loaded a new page');
  });

  await step('back: the list shows again without loading a page, and still works', async () => {
    await page.goBack();
    await page.waitForURL(`${url}/`, { timeout: TIMEOUT });
    await page.locator('.feed li').first().waitFor({ timeout: TIMEOUT });
    await page.fill('input[type=search]', 'phones');
    await page.selectOption('select[name=status]', 'all');
    await page.waitForFunction(() => document.querySelectorAll('.issues li a').length === 1, null, {
      timeout: TIMEOUT,
    });
    assert(await page.evaluate(() => window.__e2eSamePage === true), 'back loaded a new page');
  });

  await step('/about: the prerendered page opens from a link and as a file', async () => {
    await page.click('nav a[href="/about"]');
    await page.waitForFunction(() => document.title === 'About', null, { timeout: TIMEOUT });
    assert(await page.evaluate(() => window.__e2eSamePage === true), 'the link loaded a new page');
    // The #defer body of the static page renders on the server, for the user who signed in.
    await page.locator('.who', { hasText: 'You are signed in as' }).waitFor({ timeout: TIMEOUT });
    await page.goto(`${url}/about`);
    await page.locator('h1', { hasText: 'About' }).waitFor({ timeout: TIMEOUT });
    await page.locator('.who', { hasText: 'You are signed in as' }).waitFor({ timeout: TIMEOUT });
  });

  await step('320 px: no page scrolls sideways', async () => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const pathname of ['/', '/issues/3', '/issues/new', '/about']) {
      await page.goto(`${url}${pathname}`);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      assert(width <= 320, `${pathname} is ${width} px wide`);
    }
  });
  await page.close();

  // Without scripts, the forms still post, and the page shows the errors.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const plain = await context.newPage();
  const plainErrors = watch(plain, { scripts: false });
  const noScript = runner.flow('tracker', { page: plain, errors: plainErrors });
  await noScript('without scripts: sign in, and a short title shows its error', async () => {
    await plain.goto(`${url}/issues/new`);
    await plain.waitForURL('**/sign-in?next=%2Fissues%2Fnew', { timeout: TIMEOUT });
    await plain.fill('input[name=name]', 'Grace');
    await plain.click('main form button');
    await plain.waitForURL('**/issues/new', { timeout: TIMEOUT });
    await plain.fill('input[name=title]', 'No');
    await plain.click('main form button');
    await plain
      .locator('p.error', { hasText: 'Write a title of at least 3 characters' })
      .waitFor({ timeout: TIMEOUT });
    assert((await plain.inputValue('input[name=title]')) === 'No', 'the title was not kept');
  });
  await context.close();
}
