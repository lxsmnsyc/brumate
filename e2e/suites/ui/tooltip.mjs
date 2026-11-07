import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'Tooltip: after a delay on hover, at once on keyboard focus, then the next at once',
    async () => {
      await page.goto(`${url}/`);
      const copy = page.locator('.tip-trigger');
      await copy.scrollIntoViewIfNeeded();
      await copy.hover();
      await page.waitForTimeout(600);
      assert((await page.locator('[role=tooltip]').count()) === 0, 'it showed before its delay');
      await page.waitForSelector('[role=tooltip]', { timeout: 3000 });
      const tip = page.locator('[role=tooltip]');
      assert(
        (await copy.getAttribute('aria-describedby')) === (await tip.getAttribute('id')),
        'not described',
      );
      const [tipBox, triggerBox] = [await tip.boundingBox(), await copy.boundingBox()];
      assert(tipBox.y + tipBox.height <= triggerBox.y, 'not above its trigger');
      // Once one has shown, the next shows at once.
      await page.locator('.tip-other').hover();
      await page.waitForFunction(
        () => document.querySelector('[role=tooltip]')?.textContent === 'Paste the link',
        null,
        { timeout: 400 },
      );
      // Escape hides it.
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[role=tooltip]'));
      // Focus from the keyboard shows it at once.
      await page.mouse.move(0, 0);
      await page.waitForTimeout(700);
      await copy.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await page.waitForFunction(
        () => document.querySelector('[role=tooltip]')?.textContent === 'Copy the link',
        null,
        { timeout: 400 },
      );
      await page.keyboard.press('Tab');
      await page.waitForFunction(
        () => document.querySelector('[role=tooltip]')?.textContent !== 'Copy the link',
      );
    },
  );
}
