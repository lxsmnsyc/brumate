import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step('ColorArea: the keys, a press on the area, and a drag from the thumb', async () => {
    await page.goto(`${url}/`);
    const state = () => page.locator('.plane-state').textContent();
    const waitState = async (text) => {
      try {
        await page.waitForFunction(
          (t) => document.querySelector('.plane-state')?.textContent === t,
          text,
          { timeout: 5000 },
        );
      } catch {
        throw new Error(`expected ${text}, got ${await state()}`);
      }
    };
    assert(
      (await page.locator('.plane').getAttribute('style')).includes('linear-gradient'),
      'the gradient of the area',
    );
    const inputs = page.locator('.plane-thumb input');
    assert((await inputs.count()) === 2, 'an input for each axis');
    // One tab stop: the input of y is out of the tab order and hidden from screen readers.
    assert((await inputs.nth(1).getAttribute('tabindex')) === '-1', 'y is out of the tab order');
    assert((await inputs.nth(1).getAttribute('aria-hidden')) === 'true', 'y is hidden');
    assert((await inputs.first().getAttribute('aria-hidden')) === null, 'x is not hidden');
    await inputs.first().focus();
    await page.keyboard.press('ArrowRight');
    await waitState('hsb(210, 51%, 80%)');
    // Up on the input of x moves y, and the focus follows it.
    await page.keyboard.press('ArrowUp');
    await waitState('hsb(210, 51%, 81%)');
    assert(
      await inputs.nth(1).evaluate((input) => document.activeElement === input),
      'the focus follows y',
    );
    await page.keyboard.press('PageDown');
    await waitState('hsb(210, 51%, 71%)');
    await page.keyboard.press('Shift+ArrowRight');
    await waitState('hsb(210, 61%, 71%)');
    // Home goes to the least value of the axis of the focused input, which is x here.
    await page.keyboard.press('Home');
    await waitState('hsb(210, 0%, 71%)');
    // A press at the middle is half of each channel.
    const area = await page.locator('.plane').boundingBox();
    await page.mouse.click(area.x + area.width * 0.5, area.y + area.height * 0.5);
    await waitState('hsb(210, 50%, 50%)');
    // A drag from the center of the thumb to the top right corner is the ends of both.
    const thumb = await page.locator('.plane-thumb').boundingBox();
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
    await page.mouse.down();
    await page.waitForSelector('.plane-thumb[data-dragging]');
    await page.mouse.move(area.x + area.width + 20, area.y - 20, { steps: 5 });
    await waitState('hsb(210, 100%, 100%)');
    await page.mouse.up();
    assert((await state()) === 'hsb(210, 100%, 100%)', await state());
  });
}
