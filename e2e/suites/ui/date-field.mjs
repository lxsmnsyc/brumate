import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'DateField: the arrow keys step a segment, digits type and move on, Backspace empties',
    async () => {
      await page.goto(`${url}/`);
      const segment = (type) => page.locator(`.birthday-input [data-type="${type}"]`);
      const waitState = (text) =>
        page.waitForFunction(
          (t) => document.querySelector('.birthday-state')?.textContent === t,
          text,
        );
      await segment('month').focus();
      await page.keyboard.press('ArrowUp');
      await waitState('2026-11-15');
      // The browser does not change the text of a segment, and the field types the digits.
      await page.keyboard.type('03');
      await waitState('2026-03-15');
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-type') === 'day');
      await page.keyboard.type('9');
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-type') === 'year',
      );
      await waitState('2026-03-09');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await waitState('none');
      assert(
        (await segment('year').textContent()) === 'yyyy',
        `the year shows ${await segment('year').textContent()}`,
      );
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-type') === 'day');
    },
  );
}
