import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step('ColorPicker: a change in the area shows in the field and the swatch', async () => {
    await page.goto(`${url}/`);
    const field = page.locator('.mix-input');
    const swatch = () =>
      page
        .locator('.mix-swatch')
        .evaluate((element) => getComputedStyle(element).getPropertyValue('--color').trim());
    const before = await swatch();
    const text = await field.inputValue();
    assert(/^#[0-9A-F]{6}$/.test(text), `the field shows hex, got ${text}`);
    await page.locator('.mix-area input').first().focus();
    // End moves x to its maximum.
    await page.keyboard.press('End');
    try {
      await page.waitForFunction(
        () => document.querySelector('.mix-state')?.textContent === 'hsb(210, 100%, 80%)',
        undefined,
        { timeout: 5000 },
      );
    } catch {
      throw new Error(`got ${await page.locator('.mix-state').textContent()}`);
    }
    await page.waitForFunction((old) => document.querySelector('.mix-input').value !== old, text, {
      timeout: 5000,
    });
    assert((await swatch()) !== before, 'the swatch did not change');
  });
}
