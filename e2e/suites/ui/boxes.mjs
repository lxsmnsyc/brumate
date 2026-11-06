import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'Checkbox, RadioGroup and Switch: Space, the arrow keys and a required group',
    async () => {
      await page.goto(`${url}/`);
      // The boxes are required once the code of the group runs.
      await page.waitForFunction(() => document.querySelector('.toppings input')?.required);
      await page.locator('.pizza button[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('.toppings .error')?.textContent);
      // The first invalid box of the form gets focus, as the browser does with its own message.
      await page.waitForFunction(
        () => document.activeElement === document.querySelector('.toppings input'),
      );
      await page.keyboard.press('Space');
      await page.waitForFunction(() =>
        document.querySelector('.pizza-value')?.textContent?.startsWith('cheese'),
      );
      await page.waitForFunction(() => !document.querySelector('.toppings .error'));
      // The group keeps the state of every box, so the others are valid again too.
      await page.waitForFunction(() => !document.querySelector('.toppings [aria-invalid]'));
      assert(
        await page
          .locator('.toppings .box')
          .first()
          .evaluate((element) => element.hasAttribute('data-focus-visible')),
        'the box shows no focus ring after the keyboard',
      );
      // The radios are native, so the arrow keys move the choice.
      const small = page.locator('.sizes input').first();
      await small.focus();
      await page.keyboard.press('Space');
      await page.waitForFunction(() =>
        document.querySelector('.pizza-value')?.textContent?.includes('small'),
      );
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() =>
        document.querySelector('.pizza-value')?.textContent?.includes('large'),
      );
      const theme = page.locator('.theme input');
      assert((await theme.getAttribute('role')) === 'switch', 'the switch has no role');
      await page.locator('.theme').click();
      await page.waitForFunction(() =>
        document.querySelector('.theme-value')?.textContent?.includes('on'),
      );
    },
  );
}
