import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'NavigationTree: Tab through the links, Right opens, and the current page',
    async () => {
      await page.goto(`${url}/`);
      await page
        .locator('#navigation-tree')
        .evaluate((heading) => heading.setAttribute('tabindex', '-1'));
      await page.locator('#navigation-tree').focus();
      // The closed row that holds the current page is marked.
      assert(
        (await page.locator('.section-collections').getAttribute('data-current-ancestor')) !== null,
        'The row that holds the current page is not marked',
      );
      // The row without a link is no stop of Tab: Tab goes to the first link.
      await page.keyboard.press('Tab');
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('section-link-slider-link'),
      );
      await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('section-collections'),
      );
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.section-link-table-link') !== null);
      assert(
        (await page.locator('.section-link-table-link').getAttribute('aria-current')) === 'page',
        'The link of the current page has no aria-current',
      );
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('section-link-tree-link'),
      );
    },
  );
}
