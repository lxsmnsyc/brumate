import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'Select: a required one stops its form, the arrow keys open it, and Enter picks an item',
    async () => {
      await page.goto(`${url}/`);
      await page.locator('.pet-send').click();
      // The browser checks the hidden input, and focus moves to the Button with the message.
      await page.waitForSelector('.pet-error');
      await page.waitForFunction(() => document.activeElement?.classList.contains('pet-trigger'));
      assert((await page.locator('.pet-state').textContent()) === 'Not sent', 'the form was sent');
      const y = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Cat');
      assert((await page.evaluate(() => window.scrollY)) === y, 'ArrowDown scrolled the page');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement?.classList.contains('pet-trigger'));
      assert((await page.locator('.pet-trigger').textContent())?.trim() === 'Dog', 'no value');
      await page.waitForFunction(() => !document.querySelector('.pet-error'));
      await page.locator('.pet-send').click();
      await page.waitForFunction(() => document.querySelector('.pet-state')?.textContent === 'dog');
    },
  );
}
