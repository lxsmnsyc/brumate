import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step('Virtualizer: a long Tree renders the rows in view as it scrolls', async () => {
    await page.goto(`${url}/`);
    const box = page.locator('.many-box');
    await box.scrollIntoViewIfNeeded();
    // Only the rows in view render, of the 1000.
    await page.waitForFunction(() => document.querySelectorAll('.many-row').length < 30);
    await box.evaluate((element) => {
      element.scrollTop = 24 * 500;
    });
    await page.waitForFunction(() => document.querySelector('.many-many-500') !== null);
    assert((await page.locator('.many-many-0').count()) === 0, 'The first row still renders');
    const rows = await page.locator('.many-row').count();
    assert(rows < 30, `${rows} rows render`);
    // The spacers keep the height of the whole list.
    const height = await box.evaluate((element) => element.scrollHeight);
    assert(height >= 24 * 1000 - 24, `The list is ${height} pixels tall`);
  });
}
