export async function steps({ page, url, step }) {
  await step(
    'GridList: rows with Up and Down, controls with Left and Right, and Tab leaves',
    async () => {
      await page.goto(`${url}/`);
      await page.locator('#gridlist').evaluate((heading) => heading.setAttribute('tabindex', '-1'));
      await page.locator('#gridlist').focus();
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.activeElement?.classList.contains('file-row'));
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => document.activeElement?.textContent?.includes('photos'));
      await page.keyboard.press('Space');
      await page.waitForFunction(
        () => document.querySelector('.file-state')?.textContent === 'photos / none',
      );
      // The grip, the box, then the button.
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.activeElement?.classList.contains('file-open'));
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.querySelector('.file-state')?.textContent === 'photos / photos',
      );
      // Tab leaves the list from its controls.
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => !document.activeElement?.closest('.file-grid'));
    },
  );

  await step('GridList: rows move with a drag of the pointer, and from the keys', async () => {
    await page.goto(`${url}/`);
    await page.waitForLoadState('load');
    await page.locator('.file-music').scrollIntoViewIfNeeded();
    // The pointer drags the last row to the top half of the first.
    await page.locator('.file-music').dragTo(page.locator('.file-notes'), {
      targetPosition: { x: 10, y: 2 },
    });
    await page.waitForFunction(
      () => document.querySelector('.file-order')?.textContent === 'music,notes,photos',
    );
    // The grip of a row starts a drag from the keys. Down chooses the place after the last row.
    await page.locator('.drag-music').focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('.file-music[data-dragging]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForSelector(".file-photos[data-drop-target='after']");
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => document.querySelector('.file-order')?.textContent === 'notes,photos,music',
    );
  });
}
