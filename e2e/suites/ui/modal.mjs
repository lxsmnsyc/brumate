import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'Modal: the page is inert and does not scroll, focus stays inside, then comes back',
    async () => {
      await page.goto(`${url}/`);
      const trigger = page.locator('.delete-trigger');
      await trigger.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => ({
        y: window.scrollY,
        width: document.body.getBoundingClientRect().width,
      }));
      await trigger.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement?.classList.contains('confirm'));
      const open = await page.evaluate(() => ({
        overflow: document.documentElement.style.overflow,
        width: document.body.getBoundingClientRect().width,
        inert: Boolean(document.querySelector('main')?.closest('[inert]')),
        atEnd:
          document.querySelector('.backdrop')?.closest('[data-layer]')?.parentElement ===
          document.body,
        covers: (() => {
          const box = document.querySelector('.backdrop').getBoundingClientRect();
          return box.top === 0 && box.left === 0 && box.width === window.innerWidth;
        })(),
      }));
      assert(open.overflow === 'hidden', 'the root does not scroll');
      assert(
        open.width === before.width,
        `the page moved sideways: ${before.width} to ${open.width}`,
      );
      assert(open.inert && open.atEnd && open.covers, JSON.stringify(open));
      // The wheel does not scroll the page behind it.
      await page.mouse.move(10, 10);
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(100);
      assert((await page.evaluate(() => window.scrollY)) === before.y, 'the page scrolled');
      // Tab stays in the dialog.
      for (let index = 0; index < 4; index++) {
        await page.keyboard.press('Tab');
        assert(
          await page.evaluate(() => Boolean(document.activeElement?.closest('.confirm'))),
          'Tab left the dialog',
        );
      }
      // A press on the overlay does not close it, and Escape does.
      await page.mouse.click(5, 5);
      await page.waitForTimeout(100);
      assert(await page.locator('.confirm').isVisible(), 'a press outside closed it');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.backdrop'));
      assert(
        await page.evaluate(() => document.activeElement?.classList.contains('delete-trigger')),
        'focus did not go back to the trigger',
      );
      assert(
        (await page.evaluate(() => document.documentElement.style.overflow)) === '',
        'the root still does not scroll',
      );
    },
  );
}
