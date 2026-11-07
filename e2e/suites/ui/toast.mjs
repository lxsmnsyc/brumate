import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'Toast: comes in a landmark, F6 moves focus to it, and its close button gives focus back',
    async () => {
      await page.goto(`${url}/`);
      const notify = page.locator('.toast-trigger');
      await notify.scrollIntoViewIfNeeded();
      await notify.focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('[role=region][aria-label=Notifications] .toast');
      await page.waitForFunction(
        () => !document.querySelector('.toast')?.hasAttribute('data-enter'),
      );
      assert(
        (await page.locator('.toast [role=alert]').textContent()) === 'Link copied',
        'the content is not an alert',
      );
      await page.keyboard.press('F6');
      await page.waitForFunction(() => document.activeElement?.classList.contains('toast'));
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.querySelector('.toast'));
      await page.waitForFunction(() => document.activeElement?.classList.contains('toast-trigger'));
    },
  );

  await step(
    'Toast: closes after its timeout, which stops while the pointer is over it',
    async () => {
      await page.goto(`${url}/`);
      await page.locator('.toast-trigger').click();
      await page.waitForSelector('.toast');
      await page.locator('.toast').hover();
      await page.waitForTimeout(5500);
      assert(await page.locator('.toast').isVisible(), 'it closed while the pointer was over it');
      await page.mouse.move(0, 0);
      await page.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 7000 });
    },
  );
}
