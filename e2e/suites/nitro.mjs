// The Node build of examples/nitro, as `node .output/server/index.mjs` serves it.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { assert, freePort, repo, startProcess, watch } from '../lib.mjs';

const root = path.join(repo, 'examples/nitro');
const TIMEOUT = 5000;

// NODE_ENV=production, because a NODE_ENV of `test` or `development` builds for development.
export const build = [
  ['pnpm', ['--filter', 'example-nitro', 'build'], { env: { NODE_ENV: 'production' } }],
];

export async function start() {
  assert(
    existsSync(path.join(root, '.output/server/index.mjs')),
    'examples/nitro/.output is missing. Run without --no-build.',
  );
  const port = await freePort();
  const url = `http://localhost:${port}`;
  const stop = await startProcess(process.execPath, ['.output/server/index.mjs'], {
    cwd: root,
    env: { PORT: String(port), NODE_ENV: 'production' },
    url,
  });
  return { url, stop };
}

export async function run({ browser, url, runner }) {
  const page = await browser.newPage();
  const errors = watch(page);
  const step = runner.flow('nitro', { page, errors });

  await step('/: the page resumes and its counter counts', async () => {
    await page.goto(`${url}/`, { waitUntil: 'load' });
    await page.locator('h1', { hasText: 'Notes' }).waitFor({ timeout: TIMEOUT });
    await page.evaluate(() => (window.__e2eSamePage = true));
    await page.click('button.count');
    await page
      .locator('button.count', { hasText: 'Clicked 1 times' })
      .waitFor({ timeout: TIMEOUT });
  });

  await step('/: a form calls the server function and refreshes the notes', async () => {
    const note = `From e2e ${Date.now()}`;
    await page.fill('input[name=text]', note);
    await page.click('form button');
    await page.locator('li', { hasText: note }).waitFor({ timeout: TIMEOUT });
    assert(await page.evaluate(() => window.__e2eSamePage === true), 'the form loaded a new page');
    assert(
      (await page.textContent('button.count')).includes('Clicked 1 times'),
      'the counter lost its state',
    );
    await page.fill('input[name=text]', '');
    await page.click('form button');
    await page.locator('p.error', { hasText: 'Write a note' }).waitFor({ timeout: TIMEOUT });
  });
  await page.close();
}
