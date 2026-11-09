import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step('SearchField: Enter submits, Escape and the button clear', async () => {
    await page.goto(`${url}/`);
    const search = page.locator('.search input');
    await search.fill('button');
    await search.press('Enter');
    await page.waitForFunction(() =>
      document.querySelector('.searched')?.textContent?.includes('button'),
    );
    await search.press('Escape');
    await page.waitForFunction(() => document.querySelector('.search')?.hasAttribute('data-empty'));
    assert((await search.inputValue()) === '', 'Escape did not clear the field');
    await search.fill('link');
    await page.locator('.search .clear').click();
    await page.waitForFunction(() => document.querySelector('.search')?.hasAttribute('data-empty'));
  });
}
