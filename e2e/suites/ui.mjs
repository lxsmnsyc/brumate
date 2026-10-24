// The production build of examples/ui, a page of every part of @brumate/ui. Each step checks
// a part in Chrome, and the last one checks the whole page with axe-core.
import { createRequire } from 'node:module';
import path from 'node:path';
import { assert, repo, serveBuild, watch, watchPolicy } from '../lib.mjs';

const root = path.join(repo, 'examples/ui');
const axe = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export const build = [['pnpm', ['--filter', 'example-ui', 'build']]];

/** Serves the build as examples/ui/server.prod.ts does, with a nonce for each page. */
export function start() {
  return serveBuild(root);
}

export async function run({ browser, url, runner }) {
  const page = await browser.newPage();
  const errors = watch(page);
  watchPolicy(page, errors);
  const step = runner.flow('ui', { page, errors });

  await step(
    'VisuallyHidden: the skip link shows on focus, and a hidden name stays for screen readers',
    async () => {
      await page.goto(`${url}/`);
      const skip = page.locator('a.skip');
      const hidden = await skip.evaluate((element) => element.getBoundingClientRect().width);
      assert(hidden <= 1, `the skip link takes ${hidden} px before it has focus`);
      await page.keyboard.press('Tab');
      assert(
        await skip.evaluate((element) => element === document.activeElement),
        'Tab did not reach the skip link',
      );
      const shown = await skip.evaluate((element) => element.getBoundingClientRect().width);
      assert(shown > 1, 'the skip link does not show when it has focus');
      const name = await page.getByRole('button', { name: 'Close' }).count();
      assert(name === 1, 'the close button has no name for screen readers');
    },
  );

  await step(
    'Button: presses with a mouse, Enter and Space, once each, and shows its state',
    async () => {
      await page.goto(`${url}/`);
      const button = page.locator('button.press', { hasText: 'Press me' });
      const pressed = page.locator('.pressed');
      // The pointer is held, so the press shows before it ends.
      await button.hover();
      await page.mouse.down();
      await page.waitForFunction(() =>
        document.querySelector('button.press')?.hasAttribute('data-pressed'),
      );
      await page.mouse.up();
      await page.waitForFunction(() =>
        document.querySelector('.pressed')?.textContent?.includes('1 times, last with mouse'),
      );
      assert(
        !(await button.evaluate((element) => element.hasAttribute('data-pressed'))),
        'the button still shows as pressed',
      );
      assert(
        await button.evaluate((element) => element.hasAttribute('data-hovered')),
        'the button does not show the hover of the mouse',
      );
      // A press that leaves the button presses nothing.
      await page.mouse.down();
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await button.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() =>
        document.querySelector('.pressed')?.textContent?.includes('2 times, last with keyboard'),
      );
      const scroll = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('Space');
      await page.waitForFunction(() =>
        document.querySelector('.pressed')?.textContent?.includes('3 times'),
      );
      assert((await page.evaluate(() => window.scrollY)) === scroll, 'Space scrolled the page');
      assert(
        await button.evaluate((element) => element.hasAttribute('data-focus-visible')),
        'the button shows no focus ring after the keyboard',
      );
      const text = await pressed.textContent();
      assert(text.includes('3 times'), `the presses are ${text}`);
      // A disabled button presses nothing, and a pending one keeps its focus.
      const disabled = page.locator('button.press', { hasText: 'Disabled' });
      assert(await disabled.isDisabled(), 'the disabled button is not disabled');
      const pending = page.locator('button.press', { hasText: 'Saving' });
      await pending.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      assert((await pressed.textContent()).includes('3 times'), 'the pending button pressed');
    },
  );

  await step('axe-core: the page has no violations', async () => {
    await page.goto(`${url}/`);
    // axe runs as a script of the page, which Playwright adds.
    await page.addScriptTag({ path: axe });
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document);
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });
}
