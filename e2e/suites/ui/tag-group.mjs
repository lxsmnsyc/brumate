export async function steps({ page, url, step }) {
  await step('TagGroup: the arrow keys move between tags, and Delete removes one', async () => {
    await page.goto(`${url}/`);
    await page.locator('#taggroup').evaluate((heading) => heading.setAttribute('tabindex', '-1'));
    await page.locator('#taggroup').focus();
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.activeElement?.textContent?.startsWith('css'));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.textContent?.startsWith('html'));
    await page.keyboard.press('Delete');
    await page.waitForFunction(
      () => document.querySelector('.topic-state')?.textContent === 'css,js,svg',
    );
    // Focus moves on to the next tag.
    await page.waitForFunction(() => document.activeElement?.textContent?.startsWith('js'));
    await page.locator('.topic-remove').last().click();
    await page.waitForFunction(
      () => document.querySelector('.topic-state')?.textContent === 'css,js',
    );
  });
}
