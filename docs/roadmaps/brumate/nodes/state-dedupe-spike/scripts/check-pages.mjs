// Loads pages of the website build in Chrome, from its static preview, and checks that the page
// has no errors, no printed-HTML markers left and nothing left in `self.$bP`, then edits the first
// live sample and checks its highlighted backdrop follows the text, and navigates to a second page.
//
//   node check-pages.mjs /docs/context /ui/dialog
import path from 'node:path';
import { createRequire } from 'node:module';
import { findChrome } from '../../../../../../benchmarks/harness/chrome.mjs';
import { repo } from '../../../../../../e2e/lib.mjs';
import { serveStatic } from '../../../../../../benchmarks/navigation/serve.mjs';

const { chromium } = createRequire(path.join(repo, 'e2e/package.json'))('playwright-core');
const server = await serveStatic();
const browser = await chromium.launch(findChrome());
let failed = false;
try {
  for (const url of process.argv.slice(2)) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    await page.goto(server.url + url, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle').catch(() => {});
    const found = await page.evaluate(() => {
      const walker = document.createTreeWalker(document, 128);
      let markers = 0;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (/^\/?d([\da-z]{4}\.\d+)?$/.test(node.data)) {
          markers++;
        }
      }
      return { markers, left: Object.keys(self.$bP ?? {}).length, read: '$bP' in self };
    });
    let sample = 'none';
    const editor = page.locator('.live-editor textarea').first();
    if ((await editor.count()) > 0) {
      await editor.scrollIntoViewIfNeeded();
      await editor.click();
      await page.keyboard.press('End');
      await page.keyboard.type(' // edited');
      await page.waitForTimeout(500);
      const backdrop = await page.locator('.live-backdrop').first().textContent();
      sample = backdrop.includes('// edited') ? 'follows the edit' : 'stale';
    }
    console.log(
      `${url}: errors ${errors.length}, markers ${found.markers}, $bP read ${found.read}, left ${found.left}, sample ${sample}`,
    );
    for (const error of errors) {
      console.log(`  ${error}`);
    }
    if (errors.length > 0 || found.markers > 0 || found.left > 0 || sample === 'stale') {
      failed = true;
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.stop();
}
process.exit(failed ? 1 : 0);
