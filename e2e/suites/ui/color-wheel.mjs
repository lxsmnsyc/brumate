import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step('ColorWheel: the keys, a press on the ring, and a drag from the thumb', async () => {
    await page.goto(`${url}/`);
    const state = () => page.locator('.dial-state').textContent();
    const waitState = async (text) => {
      try {
        await page.waitForFunction(
          (t) => document.querySelector('.dial-state')?.textContent === t,
          text,
          { timeout: 5000 },
        );
      } catch {
        throw new Error(`expected ${text}, got ${await state()}`);
      }
    };
    assert((await page.locator('.dial-thumb input').inputValue()) === '210', 'the input');
    await page.locator('.dial-thumb input').focus();
    await page.keyboard.press('ArrowRight');
    await waitState('hsl(211, 100%, 50%)');
    // A page is to a multiple of 15.
    await page.keyboard.press('PageDown');
    await waitState('hsl(195, 100%, 50%)');
    await page.keyboard.press('Home');
    await waitState('hsl(0, 100%, 50%)');
    // The range input stops at 0, so the wheel wraps to 359.
    await page.keyboard.press('ArrowLeft');
    await waitState('hsl(359, 100%, 50%)');
    // A press on the ring below the center is 90 degrees. The middle of the ring is at 85.
    const track = await page.locator('.dial-track').boundingBox();
    const cx = track.x + track.width / 2;
    const cy = track.y + track.height / 2;
    await page.mouse.click(cx, cy + 85);
    await waitState('hsl(90, 100%, 50%)');
    // A press inside the ring does nothing, at another angle than the one before.
    await page.mouse.click(cx + 10, cy);
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert((await state()) === 'hsl(90, 100%, 50%)', `a press inside the ring: ${await state()}`);
    // A drag from the thumb to the left of the center is 180 degrees.
    await page.mouse.move(cx, cy + 85);
    await page.mouse.down();
    await page.waitForSelector('.dial-thumb[data-dragging]');
    await page.mouse.move(cx - 85, cy, { steps: 8 });
    await waitState('hsl(180, 100%, 50%)');
    await page.mouse.up();
    assert((await state()) === 'hsl(180, 100%, 50%)', await state());
  });
}
