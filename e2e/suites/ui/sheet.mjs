import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step('Sheet: along the start edge, closed by a press outside', async () => {
    await page.goto(`${url}/`);
    await page.locator('.menu-trigger').click();
    await page.waitForFunction(() => document.activeElement?.classList.contains('menu'));
    const sheet = page.locator('.sheet');
    assert((await sheet.getAttribute('data-side')) === 'left', 'not on the left');
    await page.waitForFunction(() => !document.querySelector('.sheet')?.closest('[data-enter]'));
    const box = await sheet.boundingBox();
    assert(box && Math.round(box.x) === 0, `not at the edge: ${box?.x}`);
    const size = page.viewportSize();
    await page.mouse.click(size.width - 10, size.height / 2);
    await page.waitForFunction(() => !document.querySelector('.sheet'));
    assert(
      await page.evaluate(() => document.activeElement?.classList.contains('menu-trigger')),
      'focus did not go back to the trigger',
    );
  });
}
