import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'ColorSwatchPicker: the keys select, Up and Down move by rows, and a disabled item is skipped',
    async () => {
      await page.goto(`${url}/`);
      const waitPaint = async (text) => {
        try {
          await page.waitForFunction(
            (t) => document.querySelector('.paint-state')?.textContent === t,
            text,
            { timeout: 5000 },
          );
        } catch {
          throw new Error(
            `expected ${text}, got ${await page.locator('.paint-state').textContent()}`,
          );
        }
      };
      // Focus goes to the selected item, and the arrow keys select the next.
      await page.locator('.paint').focus();
      await page.waitForFunction(() => document.activeElement?.classList.contains('paint-red'));
      await page.keyboard.press('ArrowRight');
      await waitPaint('rgb(46, 160, 67)');
      await page.keyboard.press('End');
      await waitPaint('hsl(217, 91%, 53%)');
      // The items wrap in two rows. Up goes to the item above, and Down back, in a real layout.
      await page.keyboard.press('ArrowUp');
      await waitPaint('#e2445a');
      await page.keyboard.press('ArrowDown');
      await waitPaint('hsl(217, 91%, 53%)');
      // The last item is disabled, so End skipped it, and Down from the blue one stays.
      await page.keyboard.press('ArrowDown');
      assert(
        (await page.evaluate(() => document.activeElement?.className)).includes('paint-blue'),
        'Down left the item',
      );
      // The keys and a click on a disabled item select nothing.
      await page.locator('.paint-gray').evaluate((element) => element.focus());
      await page.keyboard.press('Space');
      await page.keyboard.press('Enter');
      // Playwright does not press an element that is aria-disabled, so the press is forced.
      await page.locator('.paint-gray').click({ force: true });
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert(
        (await page.locator('.paint-state').textContent()) === 'hsl(217, 91%, 53%)',
        'disabled',
      );
      assert(
        (await page.locator('.paint-gray').getAttribute('aria-selected')) === 'false',
        'the disabled item is selected',
      );
      // A press selects the item with its own format.
      await page.locator('.paint-red').click();
      await waitPaint('#e2445a');
      assert(
        (await page.locator('.paint-red').getAttribute('aria-selected')) === 'true',
        'the pressed item is not selected',
      );
    },
  );
}
