import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'RangeCalendar: two presses pick a range, the pointer shows it, and a closed day stops it',
    async () => {
      await page.goto(`${url}/`);
      const cell = (date) =>
        page.locator(`.stay-grid [data-date="${date}"]:not([data-outside-month])`);
      const waitState = (text) =>
        page.waitForFunction((t) => document.querySelector('.stay-state')?.textContent === t, text);
      const selected = () =>
        page.evaluate(() =>
          [
            ...document.querySelectorAll('.stay-grid [data-selected]:not([data-outside-month])'),
          ].map((item) => item.getAttribute('data-date')),
        );
      await cell('2026-10-20').click();
      await cell('2026-10-22').hover();
      await page.waitForFunction(
        () =>
          document.querySelectorAll('.stay-grid [data-selected]:not([data-outside-month])')
            .length === 3,
      );
      assert(
        JSON.stringify(await selected()) === '["2026-10-20","2026-10-21","2026-10-22"]',
        `the range under the pointer is ${await selected()}`,
      );
      await cell('2026-10-22').click();
      await waitState('2026-10-20 2026-10-22');
      // October 25 is a Sunday, when the shop is closed, so a range over it is not picked. The
      // dates past it are out of reach once the range starts.
      await cell('2026-10-23').click();
      await page.waitForFunction(() =>
        document
          .querySelector('.stay-grid [data-date="2026-10-27"]:not([data-outside-month])')
          ?.hasAttribute('data-invalid'),
      );
      await cell('2026-10-27').click({ force: true });
      await page.waitForTimeout(100);
      assert(
        (await page.locator('.stay-state').textContent()) === '2026-10-20 2026-10-22',
        'a range over a closed day was picked',
      );
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () =>
          document.querySelectorAll('.stay-grid [data-selected]:not([data-outside-month])')
            .length === 3,
      );
    },
  );
}
