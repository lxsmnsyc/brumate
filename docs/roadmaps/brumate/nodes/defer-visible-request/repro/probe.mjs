// Repro for defer-visible-request. Copy later.brm and later2.brm to examples/tracker/src/routes/
// and LaterBox.brm to examples/tracker/src/, then build the tracker on Nitro
// (NODE_ENV=production pnpm --filter example-tracker build). PROBE_PATH=/later2 picks the page
// with a styled component in the body. Remove the copies afterwards.
// Usage: node probe.mjs [direct|link] [headless|chrome]
// headless: Playwright's default user agent (HeadlessChrome). chrome: the same agent without "Headless".
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../../../../../e2e/node_modules/playwright-core/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../../../examples/tracker');
const mode = process.argv[2] ?? 'direct';
// The page: /later (a block style in the body) or /later2 (a styled component in the body).
const PROBE_PATH = process.env.PROBE_PATH ?? '/later';
const agent = process.argv[3] ?? 'headless';
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
  const userAgent =
    agent === 'chrome' ? (await browser.newPage()).evaluate(() => navigator.userAgent) : undefined;
  const page = await browser.newPage(
    agent === 'chrome' ? { userAgent: (await userAgent).replace('HeadlessChrome', 'Chrome') } : {},
  );
  // Sign in.
  await page.goto(`${url}/sign-in?next=%2F`);
  await page.fill('input[name=name]', 'Ada');
  await page.click('main form button');
  await page.waitForURL(`${url}/`);
  const log = [];
  page.on('request', (r) =>
    log.push(
      `${r.method()} ${new URL(r.url()).pathname} defer=${r.headers()['x-brumate-defer'] ?? '-'} type=${r.resourceType()}`,
    ),
  );
  if (mode === 'link') {
    await page.evaluate((href) => {
      const a = document.createElement('a');
      a.href = href;
      a.id = 'probe-link';
      a.textContent = 'later';
      document.body.append(a);
    }, PROBE_PATH);
    await page.click('#probe-link');
    await page.waitForFunction(() => document.title === 'Later');
  } else {
    await page.goto(`${url}${PROBE_PATH}`);
  }
  await page.waitForTimeout(1500);
  const shown = await page.evaluate(() => ({
    later: document.querySelector('.later')?.textContent ?? null,
    fallback: document.querySelector('.later-fallback')?.textContent ?? null,
    color:
      document.querySelector('.later') && getComputedStyle(document.querySelector('.later')).color,
  }));
  const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
  const raw = await (
    await fetch(`${url}${PROBE_PATH}`, {
      headers: { cookie, 'user-agent': await page.evaluate(() => navigator.userAgent) },
    })
  ).text();
  console.log(
    JSON.stringify(
      {
        mode,
        agent,
        shown,
        requests: log,
        rawHasBody: raw.includes('Signed in as'),
        rawHasFallback: raw.includes('later-fallback'),
      },
      null,
      1,
    ),
  );
  const deferRequests = log.filter((l) => !l.includes('defer=-')).length;
  // Symptom: the body shows with no defer request.
  if (shown.later && deferRequests === 0) {
    console.log('SYMPTOM: body shown without an x-brumate-defer request');
    process.exitCode = 1;
  }
  // Second symptom: the body came in, but the rule of its block <style> does not apply.
  if (shown.later && shown.color !== 'rgb(200, 0, 0)') {
    console.log('SYMPTOM: body shown without its stylesheet');
    process.exitCode = 1;
  }
} finally {
  await browser?.close();
  app.kill();
}
