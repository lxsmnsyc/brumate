export async function steps({ page, url, step }) {
  await step(
    'TokenField: a typed tag becomes a token, and Backspace removes it whole',
    async () => {
      await page.goto(`${url}/`);
      const input = page.locator('.note-input');
      await input.click();
      await page.keyboard.press('End');
      await page.keyboard.type('#news and ');
      await page.waitForFunction(
        () => document.querySelector('.note-state')?.textContent === 'Hi [#news] and ',
      );
      await page.waitForFunction(
        () => document.querySelectorAll('.note-input .note-token').length === 1,
      );
      // The caret stays at the end, so typing goes on there.
      await page.keyboard.type('more');
      await page.waitForFunction(
        () => document.querySelector('.note-state')?.textContent === 'Hi [#news] and more',
      );
      // Backspace past the text after the token, then once more, removes the token whole.
      for (let step = 0; step < ' and more'.length; step++) {
        await page.keyboard.press('Backspace');
      }
      await page.keyboard.press('Backspace');
      await page.waitForFunction(
        () => document.querySelector('.note-state')?.textContent === 'Hi ',
      );
    },
  );
}
