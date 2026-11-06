import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'ListBox: Tab, the arrow keys, typeahead, Space, Shift, and no scroll of the page',
    async () => {
      await page.goto(`${url}/`);
      const list = page.locator('.animals');
      await list.scrollIntoViewIfNeeded();
      const y = await page.evaluate(() => window.scrollY);
      await page.locator('#listbox').evaluate((heading) => heading.setAttribute('tabindex', '-1'));
      await page.locator('#listbox').focus();
      await page.keyboard.press('Tab');
      // The list passes its focus on to its first item.
      await page.waitForFunction(() => document.activeElement?.textContent === 'Aardvark');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Dog');
      assert((await page.evaluate(() => window.scrollY)) === y, 'the arrow keys scrolled the page');
      await page.keyboard.press('Space');
      await page.waitForFunction(
        () => document.querySelector('.animals-state')?.textContent === 'Dog',
      );
      // Typeahead moves to the item that starts with what is typed, across sections.
      await page.keyboard.type('pe');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Penguin');
      await page.keyboard.press('Shift+ArrowUp');
      await page.keyboard.press('Shift+ArrowUp');
      await page.waitForFunction(
        () => document.querySelector('.animals-state')?.textContent === 'Dog, Kangaroo',
      );
      // Tab leaves the list, and Shift+Tab comes back to the item that had focus.
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => !document.activeElement?.closest('.animals'));
      await page.keyboard.press('Shift+Tab');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Kangaroo');
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () => document.querySelector('.animals-state')?.textContent === 'None',
      );
    },
  );
}
