import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step('Toolbar: the arrow keys move focus, and Tab leaves it from one item', async () => {
    await page.goto(`${url}/`);
    const cut = page.locator('.tools button', { hasText: 'Cut' });
    await cut.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Copy');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Left');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Center');
    await page.keyboard.press('Space');
    await page.waitForFunction(() =>
      document.querySelector('.aligned')?.textContent?.includes('center'),
    );
    // Tab leaves the toolbar, since only the focused item is in the order of Tab.
    await page.keyboard.press('Tab');
    const left = await page.evaluate(() => !document.activeElement?.closest('.tools'));
    assert(left, 'Tab stayed in the toolbar');
    await page.keyboard.press('Shift+Tab');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Center');
  });
}
