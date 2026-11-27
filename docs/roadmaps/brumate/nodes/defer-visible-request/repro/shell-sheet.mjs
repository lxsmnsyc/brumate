// The dropped e2e step "#defer body waits for its stylesheet", against tracker's /about as the
// Nitro build serves it now: a prerendered shell whose `load` #defer body the server fills in
// the same response (fillHoles), with no x-brumate-defer request from the browser.
// The script adds a slow stylesheet link to the filled body, and checks whether the body shows
// before the sheet applies. Needs a plain tracker build (NODE_ENV=production pnpm build).
// Usage: node shell-sheet.mjs [headless|chrome]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../../../../../e2e/node_modules/playwright-core/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../../../examples/tracker');
const agent = process.argv[2] ?? 'chrome';
const port = 4000 + Math.floor(Math.random() * 1000);
const url = `http://localhost:${port}`;
const app = spawn(process.execPath, ['.output/server/index.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), NODE_ENV: 'production' },
  stdio: 'ignore',
});
let browser;
try {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(url);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  browser = await chromium.launch();
  const probe = await browser.newPage();
  const ua = await probe.evaluate(() => navigator.userAgent);
  await probe.close();
  const page = await browser.newPage(
    agent === 'chrome' ? { userAgent: ua.replace('HeadlessChrome', 'Chrome') } : {},
  );
  await page.goto(`${url}/sign-in?next=%2F`);
  await page.fill('input[name=name]', 'Ada');
  await page.click('main form button');
  await page.waitForURL(`${url}/`);
  const log = [];
  page.on('request', (r) => r.headers()['x-brumate-defer'] && log.push(r.url()));
  await page.route('**/e2e-defer.css', async (route) => {
    await new Promise((done) => setTimeout(done, 400));
    await route.fulfill({ contentType: 'text/css', body: '.who{color:rgb(1,2,3)}' });
  });
  let filled = 0;
  await page.route('**/about', async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    // The body of the block, wherever it arrives: a filled <template b-l> or an inline render.
    body = body.replace(
      /<template b-l="([^"]+)">/g,
      (m) => (filled++, `${m}<link rel="stylesheet" href="/e2e-defer.css">`),
    );
    await route.fulfill({ response, body });
  });
  await page.addInitScript(() => {
    window.__e2eDefer = { shown: false, pending: -1 };
    new MutationObserver(() => {
      const who = document.querySelector('.who');
      if (who && /You are/.test(who.textContent) && !window.__e2eDefer.shown) {
        window.__e2eDefer.shown = true;
        const link = document.querySelector('link[href="/e2e-defer.css"]');
        window.__e2eDefer.pending = link ? (link.sheet ? 0 : 1) : -1;
      }
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  await page.goto(`${url}/about`);
  await page.locator('.who', { hasText: 'You are signed in as' }).waitFor({ timeout: 5000 });
  const seen = await page.evaluate(() => window.__e2eDefer);
  console.log(JSON.stringify({ agent, filledTemplates: filled, deferRequests: log.length, seen }));
  if (seen.pending === 1) {
    console.log('SYMPTOM: the #defer body showed before its stylesheet applied');
    process.exitCode = 1;
  }
} finally {
  await browser?.close();
  app.kill();
}
