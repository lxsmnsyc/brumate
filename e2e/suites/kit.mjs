// The production build of examples/kit-app, which renders the components of
// examples/ui-kit, a package of components.
import path from 'node:path';
import { assert, repo, serveBuild, watch, watchPolicy } from '../lib.mjs';

const root = path.join(repo, 'examples/kit-app');
const TIMEOUT = 5000;

export const build = [['pnpm', ['--filter', 'example-kit-app', 'build']]];

/** Serves the build as examples/kit-app/server.prod.ts does, with a nonce for each page. */
export function start() {
  return serveBuild(root);
}

const text = async (page, selector) => (await page.textContent(selector)).trim();

/** Waits until the text of an element is the expected one. */
function waitForText(page, selector, expected) {
  return page.waitForFunction(
    ([target, wanted]) => document.querySelector(target)?.textContent.trim() === wanted,
    [selector, expected],
    { timeout: TIMEOUT },
  );
}

export async function run({ browser, url, runner }) {
  const page = await browser.newPage();
  const errors = watch(page);
  watchPolicy(page, errors);
  const step = runner.flow('kit', { page, errors });

  await step('/: the components of the package render with their styles', async () => {
    await page.goto(`${url}/`);
    assert((await text(page, '.kit-counter')) === 'Clicked 2 times', 'the counter did not render');
    assert(
      (await text(page, '.signature')) === 'From the Greeter card',
      'the template prop did not render',
    );
    const border = await page.$eval('.kit-counter', (element) => getComputedStyle(element).border);
    assert(border.includes('rgb(0, 128, 0)'), `the counter has the border "${border}"`);
    const card = await page.$eval('.kit-card', (element) => getComputedStyle(element).borderColor);
    assert(card === 'rgb(0, 0, 255)', `the card has the border color "${card}"`);
    // The scoped style of the counter stays inside it.
    const rename = await page.$eval('.rename', (element) => getComputedStyle(element).borderColor);
    assert(rename !== 'rgb(0, 128, 0)', 'the style of the counter leaked out of it');
  });

  await step('/: a handler of a package component resumes', async () => {
    await page.click('.kit-counter');
    await waitForText(page, '.kit-counter', 'Clicked 3 times');
    assert(
      (await text(page, '.kit-double')) === 'Double: 6',
      'the memo of the module did not update',
    );
  });

  await step('/: the app changes a prop of a package component', async () => {
    await page.click('.rename');
    await waitForText(page, '.kit-counter', 'Pressed 3 times');
  });

  await step('/: a server function of the package answers', async () => {
    await page.click('.kit-greet');
    await waitForText(page, 'output', 'Hello, Ada, from the server');
  });

  await step('/: the app calls a module of reactive logic of the package', async () => {
    await page.click('.visit');
    await waitForText(page, '.visit', 'Visits: 11');
  });
  await page.close();
}
