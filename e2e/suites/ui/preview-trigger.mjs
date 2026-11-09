import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'PreviewTrigger: hover and keyboard focus show it, Tab moves in and past it, Escape gives focus back',
    async () => {
      await page.goto(`${url}/`);
      const author = page.locator('.author');
      await author.scrollIntoViewIfNeeded();
      await author.hover();
      await page.waitForTimeout(300);
      assert((await page.locator('.author-card').count()) === 0, 'it showed before its delay');
      await page.waitForSelector('.author-card', { timeout: 3000 });
      assert(
        await page.evaluate(() => !document.querySelector('main')?.closest('[inert]')),
        'the page is inert',
      );
      // The pointer moves onto the preview, which stays.
      await page.locator('.follow').hover();
      await page.waitForTimeout(400);
      assert(await page.locator('.author-card').isVisible(), 'it closed under the pointer');
      // The pointer goes elsewhere, and it hides.
      await page.mouse.move(1, 1);
      await page.waitForFunction(() => !document.querySelector('.author-card'));
      await page.waitForTimeout(700);
      // Keyboard focus shows it, Tab moves into it, and Tab past it moves on to the next link.
      await page.locator('.toast-trigger').focus();
      await author.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await page.waitForSelector('.author-card', { timeout: 3000 });
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.activeElement?.classList.contains('follow'));
      // Tab past its end moves on to the link after the trigger, and it hides.
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.activeElement?.classList.contains('reviewer'));
      await page.waitForFunction(() => !document.querySelector('.author-card'));
      await page.waitForTimeout(700);
      await page.keyboard.press('Shift+Tab');
      await page.waitForSelector('.author-card', { timeout: 3000 });
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.activeElement?.classList.contains('follow'));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.author-card'));
      await page.waitForFunction(() => document.activeElement?.classList.contains('author'));
    },
  );

  await step(
    'PreviewTrigger: a long press of a touch shows it, and the link does not navigate',
    async () => {
      await page.goto(`${url}/`);
      const author = page.locator('.author');
      await author.scrollIntoViewIfNeeded();
      const box = await author.boundingBox();
      const session = await page.context().newCDPSession(page);
      const point = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
      await page.waitForSelector('.author-card', { timeout: 3000 });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
      assert((await page.evaluate(() => location.hash)) !== '#author', 'the link navigated');
      await session.detach();
    },
  );
}
