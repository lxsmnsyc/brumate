// Renders the promotional images from their HTML layouts, at twice their size, and reports
// any text or element that spills out of its tile or card, such as a gradient number whose
// last glyph is cut off.
//
//   node harness/promo.mjs                  renders every layout of ../promo
//   node harness/promo.mjs features.html    renders one
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';

const folder = fileURLToPath(new URL('../promo/', import.meta.url));
const names = process.argv.slice(2);
const layouts = [];
if (names.length > 0) {
  layouts.push(...names);
} else {
  for (const file of readdirSync(folder)) {
    if (file.endsWith('.html')) {
      layouts.push(file);
    }
  }
}

const browser = await chromium.launch({ ...findChrome(), headless: true });
let problems = 0;
for (const layout of layouts) {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto(new URL(layout, new URL('../promo/', import.meta.url)).href);
  // Each layout sets the size of its <body>, and the image takes that size.
  const size = await page.evaluate(() => ({
    width: document.body.offsetWidth,
    height: document.body.offsetHeight,
  }));
  await page.setViewportSize(size);
  await page.waitForTimeout(300);
  const found = await page.evaluate(() => {
    const out = [];
    for (const box of document.querySelectorAll('.tile, .card')) {
      const outer = box.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(box).paddingRight);
      for (const element of box.querySelectorAll('*')) {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0) {
          continue;
        }
        if (rect.right > outer.right - pad + 1 || rect.bottom > outer.bottom + 1) {
          out.push(`"${element.textContent.trim().slice(0, 40)}" spills out of its box`);
        }
      }
      // A gradient fills only the box of its text, so a glyph past the box is cut off.
      for (const element of box.querySelectorAll('.big')) {
        const range = document.createRange();
        range.selectNodeContents(element);
        if (range.getBoundingClientRect().right > element.getBoundingClientRect().right - 2) {
          out.push(`"${element.textContent}" touches the right edge of its gradient`);
        }
      }
    }
    return out;
  });
  const output = layout.replace(/\.html$/, '.png');
  await page.screenshot({ path: `${folder}${output}` });
  await page.close();
  problems += found.length;
  console.log(
    `${output}: ${size.width * 2}×${size.height * 2}${found.length ? `\n  ${found.join('\n  ')}` : ', nothing spills'}`,
  );
}
await browser.close();
process.exitCode = problems > 0 ? 1 : 0;
