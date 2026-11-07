import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'NumberField: the arrow keys, the wheel while focused, and a held Button',
    async () => {
      await page.goto(`${url}/`);
      const input = page.locator('.quantity-input');
      await input.focus();
      const y = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('ArrowUp');
      await page.waitForFunction(
        () => document.querySelector('.quantity-state')?.textContent === '2',
      );
      assert((await page.evaluate(() => window.scrollY)) === y, 'ArrowUp scrolled the page');
      // The wheel steps the number while the input has focus, and does not scroll the page.
      await input.hover();
      await page.mouse.wheel(0, 100);
      await page.waitForFunction(
        () => document.querySelector('.quantity-state')?.textContent === '3',
      );
      assert((await page.evaluate(() => window.scrollY)) === y, 'the wheel scrolled the page');
      // After focus leaves, the wheel scrolls the page again.
      await page
        .locator('#numberfield')
        .evaluate((heading) => heading.setAttribute('tabindex', '-1'));
      await page.locator('#numberfield').focus();
      await input.hover();
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(300);
      assert(
        (await page.locator('.quantity-state').textContent()) === '3',
        'the wheel stepped without focus',
      );
      // A held Button steps up to the maximum, and focus goes to the input.
      const plus = page.locator('.quantity-plus');
      const box = await plus.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForFunction(
        () => document.querySelector('.quantity-state')?.textContent === '5',
      );
      await page.mouse.up();
      assert(
        await page.evaluate(() => document.activeElement?.classList.contains('quantity-input')),
        'focus is not in the input',
      );
      // Typed text snaps into the range when focus leaves.
      await input.fill('9');
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.querySelector('.quantity-input')?.value === '5');
    },
  );
}
