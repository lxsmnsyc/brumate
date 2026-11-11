import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'PopoverGroup: Tab from a panel to the next trigger keeps it open, opening the next closes it, and an Alert shows its role',
    async () => {
      await page.goto(`${url}/`);
      const first = page.locator('.group-a-trigger');
      await first.scrollIntoViewIfNeeded();
      await first.click();
      await page.waitForSelector('.group-a');
      await page.waitForFunction(() => document.activeElement?.closest('.group-a'));
      // Tab through the panel: Widgets, Gadgets, then the trigger of the next popover.
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.activeElement?.classList.contains('group-a-first'));
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.activeElement?.classList.contains('group-a-last'));
      await page.keyboard.press('Tab');
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('group-b-trigger'),
      );
      assert((await page.locator('.group-a').count()) === 1, 'the first popover closed');
      // Opening the next popover closes the first, as in Headless UI.
      await page.keyboard.press('Enter');
      await page.waitForSelector('.group-b');
      await page.waitForFunction(() => !document.querySelector('.group-a'));
      await page.waitForFunction(() => document.activeElement?.closest('.group-b'));
      // Shift+Tab from the start of the panel goes back to its trigger, and the panel stays open.
      await page.keyboard.press('Shift+Tab');
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('group-b-trigger'),
      );
      assert((await page.locator('.group-b').count()) === 1, 'the second popover closed');
      // Focus outside the group closes them.
      await page.locator('.group-save').focus();
      await page.waitForFunction(() => !document.querySelector('.group-a, .group-b'));
      await page.locator('.group-save').click();
      await page.waitForSelector('.group-alert');
      assert(
        (await page.locator('.group-alert').getAttribute('role')) === 'alert',
        'the alert has no role',
      );
    },
  );
}
