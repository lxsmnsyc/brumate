import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'ComboBox: typing filters, the arrow keys keep focus in the input, and Enter picks',
    async () => {
      await page.goto(`${url}/`);
      const input = page.locator('.city-input');
      await input.click();
      await page.keyboard.type('l');
      await page.waitForSelector('.city-list');
      // The items that contain "l": Berlin, Lisbon, London.
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('.city-list [role=option]')].filter((item) => !item.hidden)
            .length === 3,
      );
      await page.keyboard.type('o');
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('.city-list [role=option]')]
            .filter((item) => !item.hidden)
            .map((item) => item.textContent)
            .join() === 'London',
      );
      const y = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() =>
        document.activeElement?.getAttribute('aria-activedescendant'),
      );
      assert(
        await page.evaluate(() => document.activeElement?.classList.contains('city-input')),
        'focus left the input',
      );
      assert((await page.evaluate(() => window.scrollY)) === y, 'ArrowDown scrolled the page');
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.querySelector('.city-state')?.textContent === 'london',
      );
      assert((await input.inputValue()) === 'London', 'the input did not get the text');
      // The Button shows every item again, and a press picks one.
      await page.locator('.city-toggle').click();
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('.city-list [role=option]')].filter((item) => !item.hidden)
            .length === 5,
      );
      await page.locator('.city-list >> text=Madrid').click();
      await page.waitForFunction(
        () => document.querySelector('.city-state')?.textContent === 'madrid',
      );
      assert((await input.inputValue()) === 'Madrid', 'the press did not set the text');
    },
  );
}
