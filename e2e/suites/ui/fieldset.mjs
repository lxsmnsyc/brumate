import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step('Fieldset: a disabled fieldset disables its fields', async () => {
    await page.goto(`${url}/`);
    const input = page.locator('.fieldset-input');
    assert(await input.isDisabled(), 'the input of a disabled fieldset is enabled');
    await page.locator('.fieldset-lock').click();
    await page.waitForFunction(() => !document.querySelector('.fieldset-input')?.disabled);
    assert(
      !(await page.locator('.fieldset').evaluate((node) => node.hasAttribute('data-disabled'))),
      'the fieldset kept data-disabled',
    );
  });
}
