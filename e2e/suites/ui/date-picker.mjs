import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'DatePicker: the button opens the calendar on the date, the keys pick one, and focus comes back',
    async () => {
      await page.goto(`${url}/`);
      const waitState = (text) =>
        page.waitForFunction(
          (t) => document.querySelector('.departure-state')?.textContent === t,
          text,
        );
      const button = page.locator('.departure-button');
      await button.click();
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-date') === '2026-10-15',
      );
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-date') === '2026-10-16',
      );
      await page.keyboard.press('Enter');
      await waitState('2026-10-16');
      await page.waitForFunction(() => !document.querySelector('.departure-popover'));
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('departure-button'),
      );
      assert(
        (await page.locator('.departure-input [data-type="day"]').textContent()) === '16',
        'the segments do not show the picked date',
      );
      // Escape closes it without a pick.
      await button.click();
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-date') === '2026-10-16',
      );
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.departure-popover'));
      await waitState('2026-10-16');
    },
  );
}
