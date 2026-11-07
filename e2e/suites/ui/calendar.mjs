import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'Calendar: the keys move focus, a closed day cannot be picked, and the buttons stop at the minimum',
    async () => {
      await page.goto(`${url}/`);
      const cell = (date) =>
        page.locator(`.delivery-grid [data-date="${date}"]:not([data-outside-month])`);
      const waitState = (text) =>
        page.waitForFunction(
          (t) => document.querySelector('.delivery-state')?.textContent === t,
          text,
        );
      const waitFocus = (date) =>
        page.waitForFunction((d) => document.activeElement?.getAttribute('data-date') === d, date);
      await cell('2026-10-15').focus();
      await page.keyboard.press('ArrowRight');
      await waitFocus('2026-10-16');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await waitFocus('2026-10-18');
      // October 18 is a Sunday, when the shop is closed.
      assert(
        (await cell('2026-10-18').getAttribute('data-unavailable')) !== null,
        'Sunday is open',
      );
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowLeft');
      await waitFocus('2026-10-17');
      await page.keyboard.press('Enter');
      await waitState('2026-10-17');
      await page.locator('.delivery-next').click();
      await page.waitForFunction(
        () => document.querySelector('.delivery-heading')?.textContent === 'November 2026',
      );
      await cell('2026-11-03').click();
      await waitState('2026-11-03');
      await page.locator('.delivery-previous').click();
      await page.waitForFunction(
        () => document.querySelector('.delivery-heading')?.textContent === 'October 2026',
      );
      // The minimum is in October, so there is no month before it.
      await page.waitForFunction(() =>
        document.querySelector('.delivery-previous')?.hasAttribute('disabled'),
      );
    },
  );
}
