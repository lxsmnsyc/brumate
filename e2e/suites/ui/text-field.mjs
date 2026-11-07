import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'TextField: the message of the browser after a submit, with focus on the field',
    async () => {
      await page.goto(`${url}/`);
      const name = page.locator('.name-field input');
      await page.locator('.signup button[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('.name-field .error')?.textContent);
      assert(
        await name.evaluate((element) => element === document.activeElement),
        'the invalid field did not get focus',
      );
      assert((await name.getAttribute('aria-invalid')) === 'true', 'the field is not invalid');
      const described = await name.getAttribute('aria-describedby');
      const errorId = await page.locator('.name-field .error').getAttribute('id');
      assert(described?.includes(errorId), `aria-describedby is ${described}`);
      await name.fill('Ada');
      await page.waitForFunction(() => !document.querySelector('.name-field .error'));
      // A reset gives the field its first value, and the browser checks it again.
      await page.locator('.signup button[type=reset]').click();
      await page.waitForTimeout(100);
      assert((await name.inputValue()) === '', `the field holds ${await name.inputValue()}`);
      await page.locator('.signup button[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('.name-field .error')?.textContent);
    },
  );

  await step('TextField: a setter that refuses a letter shows the kept digits', async () => {
    await page.goto(`${url}/`);
    const digits = page.locator('.digits-field input');
    await digits.click();
    // The first key waits for the code of the page, then the refused letter goes.
    await page.keyboard.type('a');
    await page.waitForFunction(
      () => document.querySelector('.digits-field input').value === '12',
      undefined,
      { timeout: 10000 },
    );
    // A letter typed before the digits is refused, and the caret stays at the start.
    await digits.press('ArrowLeft');
    await digits.press('ArrowLeft');
    await digits.press('ArrowLeft');
    await page.keyboard.type('x');
    await page.waitForFunction(() => document.querySelector('.digits-field input').value === '12');
    const caret = await digits.evaluate((input) => input.selectionStart);
    assert(caret === 0, `the caret is at ${caret}`);
    await page.keyboard.type('7');
    await page.waitForFunction(
      () => document.querySelector('.digits')?.textContent === 'Kept 712.',
    );
    assert((await digits.inputValue()) === '712', `the field holds ${await digits.inputValue()}`);
  });
}
