import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'Autocomplete: typing filters a menu, the arrow keys move, and Enter acts',
    async () => {
      await page.goto(`${url}/`);
      const input = page.locator('.command-input');
      await input.click();
      await page.keyboard.type('file');
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('.command-menu [role=menuitem]')]
            .filter((item) => !item.hidden)
            .map((item) => item.textContent)
            .join() === 'New file,Open file',
      );
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => {
        const id = document.activeElement?.getAttribute('aria-activedescendant');
        return id && document.getElementById(id)?.textContent === 'Open file';
      });
      assert(
        await page.evaluate(() => document.activeElement?.classList.contains('command-input')),
        'focus left the input',
      );
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.querySelector('.command-state')?.textContent === 'open',
      );
      // Escape clears the field, and every item shows again.
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('.command-menu [role=menuitem]')].filter(
            (item) => !item.hidden,
          ).length === 3,
      );
    },
  );
}
