import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'Context menu: a right click opens it at the pointer, Escape gives focus back, and the context menu key opens it',
    async () => {
      await page.goto(`${url}/`);
      const area = page.locator('.context-area');
      await area.scrollIntoViewIfNeeded();
      const box = await area.boundingBox();
      const x = box.x + 40;
      const y = box.y + 20;
      await page.mouse.click(x, y, { button: 'right' });
      await page.waitForSelector('.context-menu');
      // The popover is placed a frame after it opens.
      await page.waitForFunction(
        () => document.querySelector('.context-popover')?.getBoundingClientRect().x > 0,
      );
      // The menu has its corner at the pointer, or ends at it when there is no room.
      const menu = await page.locator('.context-popover').boundingBox();
      assert(
        Math.abs(menu.x - x) < 2 || Math.abs(menu.x + menu.width - x) < 2,
        `the menu is not at the pointer: ${menu.x} for ${x}`,
      );
      assert(
        Math.abs(menu.y - y) < 2 || Math.abs(menu.y + menu.height - y) < 2,
        `the menu is not at the pointer: ${menu.y} for ${y}`,
      );
      await page.waitForFunction(() => document.activeElement?.classList.contains('context-menu'));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelectorAll('.context-menu').length === 0);
      await page.waitForFunction(() => document.activeElement?.classList.contains('context-area'));
      // The key opens it under the focused area, at the first item, and Enter acts.
      await page.keyboard.press('ContextMenu');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Open');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.querySelector('.context-state')?.textContent === 'rename',
      );
      await page.waitForFunction(() => document.activeElement?.classList.contains('context-area'));
    },
  );
  await step(
    'Shortcut: Mod+K opens the dialog, a text field keeps the key, and Mod+K closes it',
    async () => {
      await page.goto(`${url}/`);
      // The page loads its code at the start, so the shortcut is ready once the button works.
      await page.waitForSelector('.palette-trigger');
      await page.keyboard.press('ControlOrMeta+k');
      await page.waitForSelector('.palette-input');
      await page.waitForFunction(() => document.activeElement?.classList.contains('palette-input'));
      await page.keyboard.press('ControlOrMeta+k');
      await page.waitForFunction(() => document.querySelectorAll('.palette-input').length === 0);
      // A text field outside the dialog keeps the key.
      const field = page.locator('.command-input');
      await field.focus();
      await page.keyboard.press('ControlOrMeta+k');
      await new Promise((done) => setTimeout(done, 200));
      assert((await page.locator('.palette-input').count()) === 0, 'a text field lost its key');
    },
  );
}
