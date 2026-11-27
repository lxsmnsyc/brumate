// Prints what the browser's document response holds, and its request headers.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../../../../../e2e/node_modules/playwright-core/index.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../../../examples/tracker');
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
  const page = await browser.newPage();
  await page.goto(`${url}/sign-in?next=%2F`);
  await page.fill('input[name=name]', 'Ada');
  await page.click('main form button');
  await page.waitForURL(`${url}/`);
  const answer = await page.goto(`${url}/later`);
  const req = answer.request();
  console.log('REQ', JSON.stringify(await req.allHeaders()));
  console.log('RES', JSON.stringify(answer.headers()));
  const text = await answer.text();
  const i = text.indexOf('<h1>Later');
  console.log(text.slice(Math.max(0, i - 200)));
} finally {
  await browser?.close();
  app.kill();
}
