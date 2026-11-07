import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'ColorField: hex steps, a typed color commits on blur, and a channel steps in its format',
    async () => {
      await page.goto(`${url}/`);
      const waitText = async (selector, text) => {
        try {
          await page.waitForFunction(
            ([s, t]) => document.querySelector(s)?.textContent === t,
            [selector, text],
            { timeout: 5000 },
          );
        } catch {
          throw new Error(`expected ${text}, got ${await page.locator(selector).textContent()}`);
        }
      };
      const hex = page.locator('.accent-input');
      await hex.focus();
      const y = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('ArrowUp');
      await waitText('.accent-state', '#E2445B');
      assert((await page.evaluate(() => window.scrollY)) === y, 'ArrowUp scrolled the page');
      await page.keyboard.press('PageDown');
      await waitText('.accent-state', '#E2444B');
      // Typed text commits when focus leaves, and text that is not a color reverts.
      await hex.fill('369');
      await page.keyboard.press('Tab');
      await waitText('.accent-state', '#336699');
      assert((await hex.inputValue()) === '#336699', 'the hex is not formatted');
      await hex.focus();
      await hex.fill('#12');
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.querySelector('.accent-input').value === '#336699');
      await hex.focus();
      await hex.fill('');
      await page.keyboard.press('Tab');
      await waitText('.accent-state', 'None');
      // A channel field steps in the format of the channel.
      const shade = page.locator('.shade-input');
      assert((await shade.inputValue()) === '120°', await shade.inputValue());
      await shade.focus();
      await page.keyboard.press('PageUp');
      await waitText('.shade-state', 'hsl(135, 50%, 50%)');
      await page.waitForFunction(() => document.querySelector('.shade-input').value === '135°');
    },
  );
}
