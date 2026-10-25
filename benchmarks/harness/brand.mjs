// Renders the images of the brand from their sources, with the Chrome that the benchmarks use:
//
// - website/public/og.png, the link preview of the site, from website/assets/og.svg.
// - website/public/apple-touch-icon.png and packages/vscode/icon.png, from website/public/logo.svg.
// - .github/banner.png, the banner of the README, from benchmarks/promo/banner.html.
//
//   node harness/brand.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => readFileSync(repo + file, 'utf8');
// The logo on the dark tile of an icon, with its outline in the light color.
const logo = read('website/public/logo.svg')
  .replace(/<style>[\s\S]*?<\/style>/, '')
  .replace('class="line"', 'stroke="#ece8e4"');
const icon = (size, radius) =>
  `<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:transparent">` +
  `<div style="width:${size}px;height:${size}px;display:grid;place-items:center;border-radius:${radius}px;` +
  `background:radial-gradient(80% 80% at 80% 10%, rgb(240 138 82 / 28%), transparent 70%), #141210">` +
  `<div style="width:${Math.round(size * 0.66)}px;height:${Math.round(size * 0.66)}px">${logo}</div></div></body>`;

const images = [
  {
    out: 'website/public/og.png',
    width: 1200,
    height: 630,
    scale: 1,
    html: `<body style="margin:0">${read('website/assets/og.svg')}</body>`,
  },
  {
    out: 'website/public/apple-touch-icon.png',
    width: 180,
    height: 180,
    scale: 1,
    html: icon(180, 0),
  },
  {
    out: 'packages/vscode/icon.png',
    width: 128,
    height: 128,
    scale: 2,
    html: icon(128, 28),
    transparent: true,
  },
  {
    out: '.github/banner.png',
    width: 1280,
    height: 400,
    scale: 2,
    url: new URL('../promo/banner.html', import.meta.url).href,
  },
];

const browser = await chromium.launch({ ...findChrome(), headless: true });
for (const image of images) {
  const page = await browser.newPage({
    viewport: { width: image.width, height: image.height },
    deviceScaleFactor: image.scale,
  });
  if (image.url) {
    await page.goto(image.url);
  } else {
    await page.setContent(image.html);
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: repo + image.out, omitBackground: image.transparent ?? false });
  console.log(`${image.out}: ${image.width * image.scale}×${image.height * image.scale}`);
  await page.close();
}
await browser.close();
