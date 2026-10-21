// The production build of examples/todos, under a strict content security
// policy: each page allows only scripts with its nonce, and the scripts they load.
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { assert, repo, watch } from '../lib.mjs';

const root = path.join(repo, 'examples/todos');
const TIMEOUT = 5000;
// A title that closes a script, opens an HTML comment and holds U+2028.
// The state that the page inlines must escape all three.
const TRICKY = 'E2E </script><!-- \u2028 item';

export const build = [['pnpm', ['--filter', 'example-todos', 'build']]];

function headersOf(answer) {
  const headers = {};
  for (const [name, value] of answer.headers) {
    if (name !== 'set-cookie') {
      headers[name] = value;
    }
  }
  const cookies = answer.headers.getSetCookie();
  if (cookies.length > 0) {
    headers['set-cookie'] = cookies;
  }
  return headers;
}

/** Serves the build as examples/todos/server.prod.ts does, with a nonce for each page. */
export async function start() {
  const client = path.join(root, 'dist/client');
  assert(
    existsSync(path.join(root, 'dist/server/server.js')),
    'examples/todos/dist is missing. Run without --no-build.',
  );
  const server = await import(pathToFileURL(path.join(root, 'dist/server/server.js')).href);
  const manifest = JSON.parse(readFileSync(path.join(client, '.vite/manifest.json'), 'utf8'));
  const entry = `/${manifest['src/client.ts'].file}`;
  let pages = 0;

  const http = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      const webRequest = new Request(`http://localhost${request.url}`, {
        method: request.method,
        headers: request.headers,
        body: request.method === 'POST' ? Buffer.concat(chunks) : undefined,
      });
      let answer;
      if (request.method === 'POST') {
        answer = await server.handle(webRequest);
      }
      if (!answer && url.pathname.startsWith('/assets/')) {
        const file = path.join(client, path.normalize(url.pathname));
        assert(file.startsWith(client), 'outside the build');
        response.setHeader('content-type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
        response.end(await readFile(file));
        return;
      }
      const nonce = `e2e${++pages}${Math.random().toString(36).slice(2)}`;
      answer ??= await server.route(webRequest, {
        nonce,
        scripts: `<script type="module" async nonce="${nonce}" src="${entry}"></script>`,
      });
      if (!answer) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      const headers = headersOf(answer);
      if ((headers['content-type'] ?? '').includes('html')) {
        headers['content-security-policy'] = `script-src 'nonce-${nonce}' 'strict-dynamic'`;
      }
      response.writeHead(answer.status, headers);
      if (answer.body) {
        Readable.fromWeb(answer.body).pipe(response);
      } else {
        response.end();
      }
    } catch (error) {
      response.statusCode = 500;
      response.end(String(error?.stack ?? error));
    }
  });
  await new Promise((resolve) => http.listen(0, resolve));
  return {
    url: `http://localhost:${http.address().port}`,
    stop: () =>
      new Promise((resolve) => {
        http.closeAllConnections();
        http.close(resolve);
      }),
  };
}

const text = async (page, selector) => (await page.textContent(selector)).trim();

export async function run({ browser, url, runner }) {
  const page = await browser.newPage();
  const errors = watch(page);
  // A page without the nonce could not run its inline scripts, and Chrome says so as a warning.
  page.on('console', (message) => {
    if (message.type() === 'warning' && /Content Security Policy/i.test(message.text())) {
      errors.push(`CSP: ${message.text()}`);
    }
  });
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
    const before = await text(page, 'main p');
    assert(before === '1 left', `the page starts with "${before}"`);
    await page.click('button.todo >> nth=1');
    await page.waitForFunction(
      () => document.querySelector('main p').textContent.trim() === '0 left',
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
    assert((await text(page, 'main p')) === '1 left', 'the count did not include the new todo');
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
    const before = await text(page, 'main p');
    await page.click('button.todo >> nth=1');
    await page.waitForFunction(
      (previous) => document.querySelector('main p').textContent.trim() !== previous,
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
