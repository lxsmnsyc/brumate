import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'Popover: beside its trigger, focus inside, the page inert, nested, then closed',
    async () => {
      await page.goto(`${url}/`);
      const trigger = page.locator('.settings-trigger');
      await trigger.focus();
      await page.keyboard.press('Enter');
      const popover = page.locator('.popover').first();
      await page.waitForFunction(() => document.activeElement?.classList.contains('settings'));
      const placed = await page.evaluate(() => {
        const trigger = document.querySelector('.settings-trigger').getBoundingClientRect();
        const panel = document.querySelector('.popover').getBoundingClientRect();
        const arrow = document.querySelector('.arrow');
        return {
          // On the side that it took: below, or above when the trigger is low in the window.
          beside:
            document.querySelector('.popover').dataset.placement === 'top'
              ? panel.bottom <= trigger.top
              : panel.top >= trigger.bottom,
          start: Math.round(panel.left) === Math.round(trigger.left),
          side: document.querySelector('.popover').dataset.placement,
          arrow: arrow.dataset.placement,
          inert: document.querySelector('main').closest('[inert]') !== null,
          layer:
            document.querySelector('.popover').closest('[data-layer]').parentElement ===
            document.body,
        };
      });
      assert(placed.beside && placed.start, 'the popover is not beside the start of its trigger');
      assert(placed.side === placed.arrow, 'the arrow does not point at the trigger');
      assert(placed.inert, 'the page behind the popover is not inert');
      assert(placed.layer, 'the layer of the popover is not at the end of <body>');
      // Tab stays inside the dialog.
      for (let index = 0; index < 5; index++) {
        await page.keyboard.press('Tab');
      }
      assert(
        await page.evaluate(() => Boolean(document.activeElement?.closest('.settings'))),
        'Tab left the dialog',
      );
      // Focus that lands on <body> comes back to the last element that had it in the dialog.
      const last = await page.evaluate(() => document.activeElement?.className);
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForFunction((name) => document.activeElement?.className === name, last);
      // A popover inside opens in its layer, and Escape closes only it.
      await page.locator('.more-trigger').click();
      await page.waitForFunction(() => document.activeElement?.classList.contains('more-dialog'));
      const nested = await page.evaluate(
        () =>
          document
            .querySelector('.more')
            .closest('[data-layer]')
            .parentElement.closest('[data-layer]') ===
          document.querySelector('.popover').closest('[data-layer]'),
      );
      assert(nested, 'the inner popover is not in the layer of the outer one');
      await page.locator('.deep').click();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.more'));
      assert((await popover.count()) === 1, 'Escape in the inner popover closed the outer one');
      // A press outside closes it, after its leave, and focus goes back to the trigger.
      await page.mouse.click(5, 5);
      await page.waitForFunction(() =>
        document.querySelector('.popover')?.hasAttribute('data-leave'),
      );
      await page.waitForFunction(() => !document.querySelector('.popover'));
      assert(
        await trigger.evaluate((element) => element === document.activeElement),
        'focus did not go back to the trigger',
      );
      assert(
        await page.evaluate(() => document.querySelector('main').closest('[inert]') === null),
        'the page stayed inert',
      );
    },
  );
}
