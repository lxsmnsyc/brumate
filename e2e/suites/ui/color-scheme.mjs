import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step(
    'ColorScheme: a choice writes the cookie and the class of <html>, and the server renders it',
    async () => {
      await page.context().clearCookies();
      await page.goto(`${url}/`);
      await page.locator('.scheme-dark').click();
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
      const cookies = await page.context().cookies();
      assert(
        cookies.some((cookie) => cookie.name === 'color-scheme' && cookie.value === 'dark'),
        'the cookie was not written',
      );
      // The first response has the class on <html>, so the page has no flash.
      const response = await page.context().request.get(`${url}/`);
      const tag = /<html[^>]*>/.exec(await response.text())?.[0] ?? '';
      assert(/class="[^"]*\bdark\b/.test(tag), `the server did not render the dark class: ${tag}`);
      assert(tag.includes('color-scheme: dark'), `the server did not render color-scheme: ${tag}`);
      await page.locator('.scheme-light').click();
      await page.waitForFunction(() => document.documentElement.classList.contains('light'));
      // From light to system, the class follows the preference of the device.
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.locator('.scheme-system').click();
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
      await page.emulateMedia({ colorScheme: 'light' });
      await page.waitForFunction(() => document.documentElement.classList.contains('light'));
      await page.emulateMedia({ colorScheme: null });
      await page.locator('.scheme-light').click();
      await page.waitForFunction(() => {
        const classes = document.documentElement.classList;
        return classes.contains('light') && !classes.contains('dark');
      });
      await page.reload();
      assert(
        (await page.locator('html').getAttribute('data-color-scheme')) === 'light',
        'the reload lost the choice',
      );
      // The cookie stays as light: the styles of this page are for a light page, and the axe steps
      // after this one load it again, whatever the preference of the device is.
    },
  );
}
