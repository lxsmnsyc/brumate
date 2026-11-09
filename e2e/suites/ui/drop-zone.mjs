import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'DropZone: a drop of text reaches onDrop, and a click focuses its button',
    async () => {
      await page.goto(`${url}/`);
      const zone = page.locator('.drop-zone');
      await zone.scrollIntoViewIfNeeded();
      // The listeners start once the page loads.
      await page.waitForLoadState('load');
      const data = await page.evaluateHandle(() => {
        const transfer = new DataTransfer();
        transfer.setData('text/plain', 'hello');
        return transfer;
      });
      await zone.dispatchEvent('dragenter', { dataTransfer: data });
      await page.waitForSelector('.drop-zone[data-drop-target]');
      await zone.dispatchEvent('dragover', { dataTransfer: data });
      await zone.dispatchEvent('drop', { dataTransfer: data });
      await page.waitForFunction(
        () => document.querySelector('.drop-state')?.textContent === '1 items dropped.',
      );
      assert(
        (await page.locator('.drop-zone[data-drop-target]').count()) === 0,
        'The zone still shows a drag over it',
      );
      // A click on the area focuses its hidden button.
      await zone.click({ position: { x: 4, y: 4 } });
      const focused = await page.evaluate(
        () => document.activeElement?.closest('.drop-zone') !== null,
      );
      assert(focused, 'The button of the zone does not have the focus');
    },
  );
}
