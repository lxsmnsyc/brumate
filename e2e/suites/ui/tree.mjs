import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step('Tree: Right opens, Left closes and moves up, and the chevron toggles', async () => {
    await page.goto(`${url}/`);
    await page.locator('#tree').evaluate((heading) => heading.setAttribute('tabindex', '-1'));
    await page.locator('#tree').focus();
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.activeElement?.classList.contains('folder-src'));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(
      () => document.querySelector('.folder-state')?.textContent === 'src / None',
    );
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.classList.contains('folder-lib'));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('.folder-util') !== null);
    assert(
      (await page.locator('.folder-util').getAttribute('aria-level')) === '3',
      'The child of a child is not at level 3',
    );
    // Left closes the open row, then moves to the row that holds it.
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => document.querySelector('.folder-util') === null);
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => document.activeElement?.classList.contains('folder-src'));
    await page.keyboard.press('Space');
    await page.waitForFunction(
      () => document.querySelector('.folder-state')?.textContent === 'src / src',
    );
    // The chevron closes the row, and focus stays on the row.
    await page.locator('.folder-src .folder-chevron').click();
    await page.waitForFunction(() => document.querySelector('.folder-app') === null);
    await page.waitForFunction(() => document.activeElement?.classList.contains('folder-src'));
    // The tree data adds a file, which shows once its folder opens.
    await page.locator('.folder-add').click();
    await page.locator('.folder-src .folder-chevron').click();
    await page.waitForFunction(() => document.querySelector('.folder-main') !== null);
    assert(
      (await page.locator('.folder-main').getAttribute('aria-posinset')) === '3',
      'The added file is not the third in its folder',
    );
  });
}
