import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'Menu: ArrowDown opens it, the arrow keys go round, a submenu opens and closes, and Enter acts',
    async () => {
      await page.goto(`${url}/`);
      const trigger = page.locator('.edit-trigger');
      await trigger.focus();
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Cut');
      const y = await page.evaluate(() => window.scrollY);
      // The arrow keys go round, past the disabled item, and never scroll the page.
      await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Share');
      assert((await page.evaluate(() => window.scrollY)) === y, 'the arrow keys scrolled the page');
      await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Copy');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Email');
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Share');
      assert((await page.locator('.share-menu').count()) === 0, 'the submenu stayed open');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Email');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.querySelector('.menu-state')?.textContent === 'messages',
      );
      await page.waitForFunction(() => document.querySelectorAll('.action-menu').length === 0);
      await page.waitForFunction(() => document.activeElement?.classList.contains('edit-trigger'));
      // A pointer that rests on the item opens the submenu, and another item closes it.
      await trigger.click();
      await page.locator('.share').hover();
      await page.waitForSelector('.share-menu', { timeout: 3000 });
      await page.locator('.action-menu >> text=Cut').first().hover();
      await page.waitForFunction(() => !document.querySelector('.share-menu'));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelectorAll('.action-menu').length === 0);
    },
  );
}
