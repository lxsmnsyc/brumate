import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'Disclosure and Transition: Enter expands, a link into a collapsed panel opens it, a note fades out',
    async () => {
      await page.goto(`${url}/`);
      const shipping = page.locator('.faq-trigger', { hasText: 'Shipping' });
      await shipping.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.querySelector('.faq-trigger')?.getAttribute('aria-expanded') === 'true',
      );
      const returns = page.locator('.faq-panel', { hasText: 'thirty days' });
      assert(
        (await returns.getAttribute('hidden')) === 'until-found',
        'the panel is not until-found',
      );
      // A link to an ID in the collapsed panel opens it, as find in page does.
      await page.evaluate(() => {
        location.hash = 'return-window';
      });
      await page.waitForFunction(
        () => !document.querySelectorAll('.faq-panel')[1]?.hasAttribute('hidden'),
      );
      // The shipping panel has transition: it slides shut through its height, then hides.
      const shippingPanel = page.locator('.faq-panel', { hasText: 'two days' });
      // The link opened the other panel of the group, which closed this one, so it opens again.
      await shipping.click();
      await page.waitForFunction(() => {
        const panel = document.querySelector('.faq-panel');
        return panel && !panel.hasAttribute('hidden') && !panel.hasAttribute('data-transition');
      });
      await shipping.click();
      await page.waitForFunction(() =>
        document.querySelector('.faq-panel')?.hasAttribute('data-leave'),
      );
      const heights = await shippingPanel.evaluate(async (panel) => {
        const seen = new Set();
        for (let frame = 0; frame < 30 && !panel.hasAttribute('hidden'); frame++) {
          seen.add(Math.round(panel.getBoundingClientRect().height));
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        return [...seen];
      });
      assert(heights.length > 2, `the panel did not slide, with heights ${heights.join(', ')}`);
      await page.waitForFunction(
        () => document.querySelector('.faq-panel')?.getAttribute('hidden') === 'until-found',
      );
      await page.locator('.note-toggle').click();
      await page.waitForFunction(() => document.querySelector('.note')?.hasAttribute('data-leave'));
      // It stays for its transition, then leaves the page.
      assert((await page.locator('.note').count()) === 1, 'the note left before its transition');
      await page.waitForFunction(() => !document.querySelector('.note'));
    },
  );
}
