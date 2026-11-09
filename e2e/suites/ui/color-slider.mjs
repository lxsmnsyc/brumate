import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step('ColorSlider: the keys, a press on the track, and a drag from the thumb', async () => {
    await page.goto(`${url}/`);
    const state = () => page.locator('.tint-state').textContent();
    const waitState = async (text) => {
      try {
        await page.waitForFunction(
          (t) => document.querySelector('.tint-state')?.textContent === t,
          text,
          { timeout: 5000 },
        );
      } catch {
        throw new Error(`expected ${text}, got ${await state()}`);
      }
    };
    assert((await page.locator('.tint-output').textContent()) === '210°', 'the output');
    assert(
      (
        await page
          .locator('.tint')
          .evaluate((slider) => getComputedStyle(slider).getPropertyValue('--track-background'))
      ).includes('linear-gradient'),
      'the gradient of the track',
    );
    await page.locator('.tint-thumb input').focus();
    await page.keyboard.press('ArrowRight');
    await waitState('hsl(211, 100%, 50%)');
    await page.keyboard.press('PageDown');
    await waitState('hsl(196, 100%, 50%)');
    // Shift with an arrow moves a page, as in React Aria.
    await page.keyboard.press('Shift+ArrowLeft');
    await waitState('hsl(181, 100%, 50%)');
    await page.keyboard.press('End');
    await waitState('hsl(360, 100%, 50%)');
    // A press at half of the track is 180 degrees.
    const track = await page.locator('.tint-track').boundingBox();
    await page.mouse.click(track.x + track.width * 0.5, track.y + track.height / 2);
    await waitState('hsl(180, 100%, 50%)');
    // A drag from the center of the thumb to three quarters is 270 degrees.
    const thumb = await page.locator('.tint-thumb').boundingBox();
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
    await page.mouse.down();
    await page.waitForSelector('.tint-thumb[data-dragging]');
    await page.mouse.move(track.x + track.width * 0.75, track.y + track.height / 2, { steps: 5 });
    await waitState('hsl(270, 100%, 50%)');
    await page.mouse.up();
    assert((await page.locator('.tint-output').textContent()) === '270°', await state());
  });
}
