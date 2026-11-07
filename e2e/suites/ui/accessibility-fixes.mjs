import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'Accessibility fixes: a disabled link out of the order of Tab, read-only boxes, descriptions',
    async () => {
      await page.goto(`${url}/`);
      const off = page.locator('.link', { hasText: 'a disabled link' });
      assert(
        (await off.getAttribute('tabindex')) === null,
        'the disabled link is in the order of Tab',
      );
      // A read-only radio keeps its choice on a click and on the arrow keys.
      const thin = page.locator('.crust input').first();
      const thick = page.locator('.crust input').last();
      await page.locator('.crust .box').last().click();
      await page.waitForTimeout(100);
      assert(await thin.isChecked(), 'a click changed the read-only choice');
      assert(!(await thick.isChecked()), 'a click checked a read-only radio');
      await thin.focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(100);
      assert(await thin.isChecked(), 'an arrow key changed the read-only choice');
      const sauce = page.locator('.sauce input');
      await page.locator('.sauce').click();
      await sauce.focus();
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);
      assert(await sauce.isChecked(), 'the read-only box changed');
      // A field without a description leaves its ID out once the browser is idle.
      const bio = page.locator('.bio-field textarea');
      await page.waitForFunction(
        () => !document.querySelector('.bio-field textarea')?.hasAttribute('aria-describedby'),
      );
      const name = page.locator('.name-field input');
      const described = await name.getAttribute('aria-describedby');
      assert(
        described && (await page.locator(`#${described}`).count()) === 1,
        `the name field names ${described}`,
      );
      assert((await bio.count()) === 1, 'the bio field is missing');
    },
  );
}
