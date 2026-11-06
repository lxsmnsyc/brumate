import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'ToggleButton, Link and Group: pin with Space, follow a link with Enter, focus within',
    async () => {
      await page.goto(`${url}/`);
      const pin = page.locator('button.pin');
      await pin.focus();
      await page.keyboard.press('Space');
      await page.waitForFunction(() =>
        document.querySelector('.pinned')?.textContent?.includes('is pinned'),
      );
      assert((await pin.getAttribute('aria-pressed')) === 'true', 'the pin is not pressed');
      const link = page.locator('a.link', { hasText: 'This section' });
      await link.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => location.hash === '#link');
      const off = page.locator('.link', { hasText: 'a disabled link' });
      assert((await off.getAttribute('href')) === null, 'the disabled link has an address');
      await page.locator('#amount').focus();
      await page.waitForFunction(() =>
        document.querySelector('.amount')?.hasAttribute('data-focus-within'),
      );
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      assert(
        await page
          .locator('.amount')
          .evaluate((element) => element.hasAttribute('data-focus-within')),
        'focus inside the group left it',
      );
    },
  );
}
