import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'DateRangePicker: the end field steps, and two presses in the calendar pick a range that closes it',
    async () => {
      await page.goto(`${url}/`);
      const waitState = (text) =>
        page.waitForFunction(
          (t) => document.querySelector('.booking-state')?.textContent === t,
          text,
        );
      await page.locator('.booking-end [data-type="day"]').focus();
      await page.keyboard.press('ArrowUp');
      await waitState('2026-10-12 2026-10-16');
      await page.locator('.booking-button').click();
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-date') === '2026-10-12',
      );
      const cell = (date) =>
        page.locator(`.booking-grid [data-date="${date}"]:not([data-outside-month])`);
      await cell('2026-10-20').click();
      await cell('2026-10-22').click();
      await waitState('2026-10-20 2026-10-22');
      await page.waitForFunction(() => !document.querySelector('.booking-popover'));
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('booking-button'),
      );
      assert(
        (await page.locator('.booking-end [data-type="day"]').textContent()) === '22',
        'the end field does not show the picked end',
      );
    },
  );
}
