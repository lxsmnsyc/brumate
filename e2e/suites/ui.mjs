// The production build of examples/ui, a page of every part of @brumate/ui. Each step checks
// a part in Chrome, and the last one checks the whole page with axe-core.
import { createRequire } from 'node:module';
import path from 'node:path';
import { assert, repo, serveBuild, watch, watchPolicy } from '../lib.mjs';

const root = path.join(repo, 'examples/ui');
const axe = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export const build = [['pnpm', ['--filter', 'example-ui', 'build']]];

/** Serves the build as examples/ui/server.prod.ts does, with a nonce for each page. */
export function start() {
  return serveBuild(root);
}

export async function run({ browser, url, runner }) {
  const page = await browser.newPage();
  const errors = watch(page);
  watchPolicy(page, errors);
  const step = runner.flow('ui', { page, errors });

  await step(
    'VisuallyHidden: the skip link shows on focus, and a hidden name stays for screen readers',
    async () => {
      await page.goto(`${url}/`);
      const skip = page.locator('a.skip');
      const hidden = await skip.evaluate((element) => element.getBoundingClientRect().width);
      assert(hidden <= 1, `the skip link takes ${hidden} px before it has focus`);
      await page.keyboard.press('Tab');
      assert(
        await skip.evaluate((element) => element === document.activeElement),
        'Tab did not reach the skip link',
      );
      const shown = await skip.evaluate((element) => element.getBoundingClientRect().width);
      assert(shown > 1, 'the skip link does not show when it has focus');
      const name = await page.getByRole('button', { name: 'Close' }).count();
      assert(name === 1, 'the close button has no name for screen readers');
    },
  );

  await step(
    'Button: presses with a mouse, Enter and Space, once each, and shows its state',
    async () => {
      await page.goto(`${url}/`);
      const button = page.locator('button.press', { hasText: 'Press me' });
      const pressed = page.locator('.pressed');
      // The pointer is held, so the press shows before it ends.
      await button.hover();
      await page.mouse.down();
      await page.waitForFunction(() =>
        document.querySelector('button.press')?.hasAttribute('data-pressed'),
      );
      await page.mouse.up();
      await page.waitForFunction(() =>
        document.querySelector('.pressed')?.textContent?.includes('1 times, last with mouse'),
      );
      assert(
        !(await button.evaluate((element) => element.hasAttribute('data-pressed'))),
        'the button still shows as pressed',
      );
      assert(
        await button.evaluate((element) => element.hasAttribute('data-hovered')),
        'the button does not show the hover of the mouse',
      );
      // A press that leaves the button presses nothing.
      await page.mouse.down();
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await button.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() =>
        document.querySelector('.pressed')?.textContent?.includes('2 times, last with keyboard'),
      );
      const scroll = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('Space');
      await page.waitForFunction(() =>
        document.querySelector('.pressed')?.textContent?.includes('3 times'),
      );
      assert((await page.evaluate(() => window.scrollY)) === scroll, 'Space scrolled the page');
      assert(
        await button.evaluate((element) => element.hasAttribute('data-focus-visible')),
        'the button shows no focus ring after the keyboard',
      );
      const text = await pressed.textContent();
      assert(text.includes('3 times'), `the presses are ${text}`);
      // A disabled button presses nothing, and a pending one keeps its focus.
      const disabled = page.locator('button.press', { hasText: 'Disabled' });
      assert(await disabled.isDisabled(), 'the disabled button is not disabled');
      const pending = page.locator('button.press', { hasText: 'Saving' });
      await pending.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      assert((await pressed.textContent()).includes('3 times'), 'the pending button pressed');
    },
  );

  await step(
    'ToggleButton, Link and Group: pin with Space, follow a link with Enter, focus within',
    async () => {
      await page.goto(`${url}/`);
      const pin = page.locator('button.pin');
      await pin.focus();
      await page.keyboard.press('Space');
      await page.waitForFunction(() =>
        document.querySelector('.pinned')?.textContent?.includes('is pinned'),
      );
      assert((await pin.getAttribute('aria-pressed')) === 'true', 'the pin is not pressed');
      const link = page.locator('a.link', { hasText: 'This section' });
      await link.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => location.hash === '#link');
      const off = page.locator('.link', { hasText: 'a disabled link' });
      assert((await off.getAttribute('href')) === null, 'the disabled link has an address');
      await page.locator('#amount').focus();
      await page.waitForFunction(() =>
        document.querySelector('.amount')?.hasAttribute('data-focus-within'),
      );
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      assert(
        await page
          .locator('.amount')
          .evaluate((element) => element.hasAttribute('data-focus-within')),
        'focus inside the group left it',
      );
    },
  );

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
    },
  );

  await step(
    'TextField with createForm: the errors of the reply, then a post that passes',
    async () => {
      await page.goto(`${url}/`);
      const email = page.locator('.order input');
      await email.fill('ada@');
      await page.locator('.order button[type=submit]').click();
      await page.waitForFunction(() =>
        document
          .querySelector('.order .error')
          ?.textContent?.includes('Write a whole email address'),
      );
      assert((await email.getAttribute('aria-invalid')) === 'true', 'the email is not invalid');
      await email.fill('ada@example.com');
      await page.locator('.order button[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('.ordered'));
    },
  );

  await step('SearchField: Enter submits, Escape and the button clear', async () => {
    await page.goto(`${url}/`);
    const search = page.locator('.search input');
    await search.fill('button');
    await search.press('Enter');
    await page.waitForFunction(() =>
      document.querySelector('.searched')?.textContent?.includes('button'),
    );
    await search.press('Escape');
    await page.waitForFunction(() => document.querySelector('.search')?.hasAttribute('data-empty'));
    assert((await search.inputValue()) === '', 'Escape did not clear the field');
    await search.fill('link');
    await page.locator('.search .clear').click();
    await page.waitForFunction(() => document.querySelector('.search')?.hasAttribute('data-empty'));
  });

  await step(
    'Checkbox, RadioGroup and Switch: Space, the arrow keys and a required group',
    async () => {
      await page.goto(`${url}/`);
      await page.locator('.pizza button[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('.toppings .error')?.textContent);
      const cheese = page.locator('.toppings input').first();
      await cheese.focus();
      await page.keyboard.press('Space');
      await page.waitForFunction(() =>
        document.querySelector('.pizza-value')?.textContent?.startsWith('cheese'),
      );
      await page.waitForFunction(() => !document.querySelector('.toppings .error'));
      assert(
        await page
          .locator('.toppings .box')
          .first()
          .evaluate((element) => element.hasAttribute('data-focus-visible')),
        'the box shows no focus ring after the keyboard',
      );
      // The radios are native, so the arrow keys move the choice.
      const small = page.locator('.sizes input').first();
      await small.focus();
      await page.keyboard.press('Space');
      await page.waitForFunction(() =>
        document.querySelector('.pizza-value')?.textContent?.includes('small'),
      );
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() =>
        document.querySelector('.pizza-value')?.textContent?.includes('large'),
      );
      const theme = page.locator('.theme input');
      assert((await theme.getAttribute('role')) === 'switch', 'the switch has no role');
      await page.locator('.theme').click();
      await page.waitForFunction(() =>
        document.querySelector('.theme-value')?.textContent?.includes('on'),
      );
    },
  );

  await step('axe-core: the page has no violations', async () => {
    await page.goto(`${url}/`);
    // axe runs as a script of the page, which Playwright adds.
    await page.addScriptTag({ path: axe });
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document);
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });
}
