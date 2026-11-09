import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step('Table: rows, cells and headers with the keys, sorting and selection', async () => {
    await page.goto(`${url}/`);
    await page.locator('#table').evaluate((heading) => heading.setAttribute('tabindex', '-1'));
    await page.locator('#table').focus();
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.activeElement?.classList.contains('planet-mercury'));
    await page.keyboard.press('Space');
    await page.waitForFunction(
      () => document.querySelector('.planet-state')?.textContent === 'mercury / unsorted',
    );
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() =>
      document.activeElement?.classList.contains('planet-moons-earth'),
    );
    // Up from the first row goes to the column of the cell, which Enter sorts by.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction(() =>
      document.activeElement?.classList.contains('planet-moons-column'),
    );
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => document.querySelector('.planet-state')?.textContent === 'mercury / moons descending',
    );
    const order = await page.locator('.planet-name').allTextContents();
    assert(order.join(',') === 'Mars,Earth,Mercury', `The rows are in the order ${order}`);
    // A drag of the resizer widens the column.
    const before = await page.locator('.planet-name-column').evaluate((th) => th.offsetWidth);
    // The hover scrolls the resizer into view, so its box is where the pointer goes.
    await page.locator('.planet-resizer').hover();
    const bar = await page.locator('.planet-resizer').boundingBox();
    await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
    await page.mouse.down();
    await page.mouse.move(bar.x + bar.width / 2 + 60, bar.y + bar.height / 2, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(
      (width) => document.querySelector('.planet-name-column').offsetWidth >= width + 50,
      before,
    );
    // The box in the header selects every row, in the order of the table.
    await page.locator('.planet-all').click();
    await page.waitForFunction(
      () =>
        document.querySelector('.planet-state')?.textContent ===
        'mars,earth,mercury / moons descending',
    );
  });
}
