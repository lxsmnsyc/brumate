import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'Slider: the keys, a press on the track, and a drag that stops at the other thumb',
    async () => {
      await page.goto(`${url}/`);
      const state = () => page.locator('.span-state').textContent();
      const waitState = async (text) => {
        try {
          await page.waitForFunction(
            (t) => document.querySelector('.span-state')?.textContent === t,
            text,
            { timeout: 5000 },
          );
        } catch {
          throw new Error(`expected ${text}, got ${await state()}`);
        }
      };
      await page.locator('.span-low input').focus();
      await page.keyboard.press('ArrowRight');
      await waitState('30 60');
      await page.keyboard.press('Home');
      await waitState('0 60');
      // A press at 90% of the track moves the end thumb, which is nearer.
      const track = await page.locator('.span-track').boundingBox();
      await page.mouse.click(track.x + track.width * 0.9, track.y + track.height / 2);
      await waitState('0 90');
      // A drag of the start thumb stops at the end thumb.
      const low = await page.locator('.span-low').boundingBox();
      await page.mouse.move(low.x + low.width / 2, low.y + low.height / 2);
      await page.mouse.down();
      // The code of the thumb may load on this press, and the drag follows the pointer after.
      await page.waitForSelector('.span-low[data-dragging]');
      await page.mouse.move(track.x + track.width * 0.5, track.y + track.height / 2, { steps: 5 });
      await waitState('50 90');
      await page.mouse.move(track.x + track.width, track.y + track.height / 2, { steps: 5 });
      await page.mouse.up();
      await waitState('90 90');
      assert((await page.locator('.span-output').textContent()).includes('90'), await state());
    },
  );
}
