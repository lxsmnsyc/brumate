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
      // Enter held down presses once, though the browser clicks for each repeat.
      await page.keyboard.down('Enter');
      await page.keyboard.down('Enter');
      await page.keyboard.down('Enter');
      await page.keyboard.up('Enter');
      await page.waitForTimeout(100);
      const text = await pressed.textContent();
      assert(text.includes('4 times'), `the presses are ${text}`);
      // Space on a submit button sends its form.
      await page.locator('.send button').focus();
      await page.keyboard.press('Space');
      await page.waitForFunction(() =>
        document.querySelector('.sent')?.textContent?.includes('Sent 1 times'),
      );
      // A disabled button presses nothing, and a pending one keeps its focus.
      const disabled = page.locator('button.press', { hasText: 'Disabled' });
      assert(await disabled.isDisabled(), 'the disabled button is not disabled');
      const pending = page.locator('button.press', { hasText: 'Saving' });
      await pending.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      assert((await pressed.textContent()).includes('4 times'), 'the pending button pressed');
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
      // A reset gives the field its first value, and the browser checks it again.
      await page.locator('.signup button[type=reset]').click();
      await page.waitForTimeout(100);
      assert((await name.inputValue()) === '', `the field holds ${await name.inputValue()}`);
      await page.locator('.signup button[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('.name-field .error')?.textContent);
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
      // The boxes are required once the code of the group runs.
      await page.waitForFunction(() => document.querySelector('.toppings input')?.required);
      await page.locator('.pizza button[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('.toppings .error')?.textContent);
      // The first invalid box of the form gets focus, as the browser does with its own message.
      await page.waitForFunction(
        () => document.activeElement === document.querySelector('.toppings input'),
      );
      await page.keyboard.press('Space');
      await page.waitForFunction(() =>
        document.querySelector('.pizza-value')?.textContent?.startsWith('cheese'),
      );
      await page.waitForFunction(() => !document.querySelector('.toppings .error'));
      // The group keeps the state of every box, so the others are valid again too.
      await page.waitForFunction(() => !document.querySelector('.toppings [aria-invalid]'));
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

  await step('Toolbar: the arrow keys move focus, and Tab leaves it from one item', async () => {
    await page.goto(`${url}/`);
    const cut = page.locator('.tools button', { hasText: 'Cut' });
    await cut.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Copy');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Left');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Center');
    await page.keyboard.press('Space');
    await page.waitForFunction(() =>
      document.querySelector('.aligned')?.textContent?.includes('center'),
    );
    // Tab leaves the toolbar, since only the focused item is in the order of Tab.
    await page.keyboard.press('Tab');
    const left = await page.evaluate(() => !document.activeElement?.closest('.tools'));
    assert(left, 'Tab stayed in the toolbar');
    await page.keyboard.press('Shift+Tab');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Center');
  });

  await step(
    'Accessibility fixes: a disabled link out of the order of Tab, read-only boxes, descriptions',
    async () => {
      await page.goto(`${url}/`);
      const off = page.locator('.link', { hasText: 'a disabled link' });
      assert(
        (await off.getAttribute('tabindex')) === null,
        'the disabled link is in the order of Tab',
      );
      // A read-only radio keeps its choice on a click and on the arrow keys.
      const thin = page.locator('.crust input').first();
      const thick = page.locator('.crust input').last();
      await page.locator('.crust .box').last().click();
      await page.waitForTimeout(100);
      assert(await thin.isChecked(), 'a click changed the read-only choice');
      assert(!(await thick.isChecked()), 'a click checked a read-only radio');
      await thin.focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(100);
      assert(await thin.isChecked(), 'an arrow key changed the read-only choice');
      const sauce = page.locator('.sauce input');
      await page.locator('.sauce').click();
      await sauce.focus();
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);
      assert(await sauce.isChecked(), 'the read-only box changed');
      // A field without a description leaves its ID out once the browser is idle.
      const bio = page.locator('.bio-field textarea');
      await page.waitForFunction(
        () => !document.querySelector('.bio-field textarea')?.hasAttribute('aria-describedby'),
      );
      const name = page.locator('.name-field input');
      const described = await name.getAttribute('aria-describedby');
      assert(
        described && (await page.locator(`#${described}`).count()) === 1,
        `the name field names ${described}`,
      );
      assert((await bio.count()) === 1, 'the bio field is missing');
    },
  );

  await step(
    'Disclosure and Transition: Enter expands, a link into a collapsed panel opens it, a note fades out',
    async () => {
      await page.goto(`${url}/`);
      const shipping = page.locator('.faq-trigger', { hasText: 'Shipping' });
      await shipping.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.querySelector('.faq-trigger')?.getAttribute('aria-expanded') === 'true',
      );
      const returns = page.locator('.faq-panel', { hasText: 'thirty days' });
      assert(
        (await returns.getAttribute('hidden')) === 'until-found',
        'the panel is not until-found',
      );
      // A link to an ID in the collapsed panel opens it, as find in page does.
      await page.evaluate(() => {
        location.hash = 'return-window';
      });
      await page.waitForFunction(
        () => !document.querySelectorAll('.faq-panel')[1]?.hasAttribute('hidden'),
      );
      // The shipping panel has transition: it slides shut through its height, then hides.
      const shippingPanel = page.locator('.faq-panel', { hasText: 'two days' });
      // The link opened the other panel of the group, which closed this one, so it opens again.
      await shipping.click();
      await page.waitForFunction(() => {
        const panel = document.querySelector('.faq-panel');
        return panel && !panel.hasAttribute('hidden') && !panel.hasAttribute('data-transition');
      });
      await shipping.click();
      await page.waitForFunction(() =>
        document.querySelector('.faq-panel')?.hasAttribute('data-leave'),
      );
      const heights = await shippingPanel.evaluate(async (panel) => {
        const seen = new Set();
        for (let frame = 0; frame < 30 && !panel.hasAttribute('hidden'); frame++) {
          seen.add(Math.round(panel.getBoundingClientRect().height));
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        return [...seen];
      });
      assert(heights.length > 2, `the panel did not slide, with heights ${heights.join(', ')}`);
      await page.waitForFunction(
        () => document.querySelector('.faq-panel')?.getAttribute('hidden') === 'until-found',
      );
      await page.locator('.note-toggle').click();
      await page.waitForFunction(() => document.querySelector('.note')?.hasAttribute('data-leave'));
      // It stays for its transition, then leaves the page.
      assert((await page.locator('.note').count()) === 1, 'the note left before its transition');
      await page.waitForFunction(() => !document.querySelector('.note'));
    },
  );

  await step(
    'Popover: beside its trigger, focus inside, the page inert, nested, then closed',
    async () => {
      await page.goto(`${url}/`);
      const trigger = page.locator('.settings-trigger');
      await trigger.focus();
      await page.keyboard.press('Enter');
      const popover = page.locator('.popover').first();
      await page.waitForFunction(() => document.activeElement?.classList.contains('settings'));
      const placed = await page.evaluate(() => {
        const trigger = document.querySelector('.settings-trigger').getBoundingClientRect();
        const panel = document.querySelector('.popover').getBoundingClientRect();
        const arrow = document.querySelector('.arrow');
        return {
          // On the side that it took: below, or above when the trigger is low in the window.
          beside:
            document.querySelector('.popover').dataset.placement === 'top'
              ? panel.bottom <= trigger.top
              : panel.top >= trigger.bottom,
          start: Math.round(panel.left) === Math.round(trigger.left),
          side: document.querySelector('.popover').dataset.placement,
          arrow: arrow.dataset.placement,
          inert: document.querySelector('main').closest('[inert]') !== null,
          layer:
            document.querySelector('.popover').closest('[data-layer]').parentElement ===
            document.body,
        };
      });
      assert(placed.beside && placed.start, 'the popover is not beside the start of its trigger');
      assert(placed.side === placed.arrow, 'the arrow does not point at the trigger');
      assert(placed.inert, 'the page behind the popover is not inert');
      assert(placed.layer, 'the layer of the popover is not at the end of <body>');
      // Tab stays inside the dialog.
      for (let index = 0; index < 5; index++) {
        await page.keyboard.press('Tab');
      }
      assert(
        await page.evaluate(() => Boolean(document.activeElement?.closest('.settings'))),
        'Tab left the dialog',
      );
      // Focus that lands on <body> comes back to the last element that had it in the dialog.
      const last = await page.evaluate(() => document.activeElement?.className);
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForFunction((name) => document.activeElement?.className === name, last);
      // A popover inside opens in its layer, and Escape closes only it.
      await page.locator('.more-trigger').click();
      await page.waitForFunction(() => document.activeElement?.classList.contains('more-dialog'));
      const nested = await page.evaluate(
        () =>
          document
            .querySelector('.more')
            .closest('[data-layer]')
            .parentElement.closest('[data-layer]') ===
          document.querySelector('.popover').closest('[data-layer]'),
      );
      assert(nested, 'the inner popover is not in the layer of the outer one');
      await page.locator('.deep').click();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.more'));
      assert((await popover.count()) === 1, 'Escape in the inner popover closed the outer one');
      // A press outside closes it, after its leave, and focus goes back to the trigger.
      await page.mouse.click(5, 5);
      await page.waitForFunction(() =>
        document.querySelector('.popover')?.hasAttribute('data-leave'),
      );
      await page.waitForFunction(() => !document.querySelector('.popover'));
      assert(
        await trigger.evaluate((element) => element === document.activeElement),
        'focus did not go back to the trigger',
      );
      assert(
        await page.evaluate(() => document.querySelector('main').closest('[inert]') === null),
        'the page stayed inert',
      );
    },
  );

  await step(
    'Modal: the page is inert and does not scroll, focus stays inside, then comes back',
    async () => {
      await page.goto(`${url}/`);
      const trigger = page.locator('.delete-trigger');
      await trigger.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => ({
        y: window.scrollY,
        width: document.body.getBoundingClientRect().width,
      }));
      await trigger.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement?.classList.contains('confirm'));
      const open = await page.evaluate(() => ({
        overflow: document.documentElement.style.overflow,
        width: document.body.getBoundingClientRect().width,
        inert: Boolean(document.querySelector('main')?.closest('[inert]')),
        atEnd:
          document.querySelector('.backdrop')?.closest('[data-layer]')?.parentElement ===
          document.body,
        covers: (() => {
          const box = document.querySelector('.backdrop').getBoundingClientRect();
          return box.top === 0 && box.left === 0 && box.width === window.innerWidth;
        })(),
      }));
      assert(open.overflow === 'hidden', 'the root does not scroll');
      assert(
        open.width === before.width,
        `the page moved sideways: ${before.width} to ${open.width}`,
      );
      assert(open.inert && open.atEnd && open.covers, JSON.stringify(open));
      // The wheel does not scroll the page behind it.
      await page.mouse.move(10, 10);
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(100);
      assert((await page.evaluate(() => window.scrollY)) === before.y, 'the page scrolled');
      // Tab stays in the dialog.
      for (let index = 0; index < 4; index++) {
        await page.keyboard.press('Tab');
        assert(
          await page.evaluate(() => Boolean(document.activeElement?.closest('.confirm'))),
          'Tab left the dialog',
        );
      }
      // A press on the overlay does not close it, and Escape does.
      await page.mouse.click(5, 5);
      await page.waitForTimeout(100);
      assert(await page.locator('.confirm').isVisible(), 'a press outside closed it');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.backdrop'));
      assert(
        await page.evaluate(() => document.activeElement?.classList.contains('delete-trigger')),
        'focus did not go back to the trigger',
      );
      assert(
        (await page.evaluate(() => document.documentElement.style.overflow)) === '',
        'the root still does not scroll',
      );
    },
  );

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

  await step(
    'Tooltip: after a delay on hover, at once on keyboard focus, then the next at once',
    async () => {
      await page.goto(`${url}/`);
      const copy = page.locator('.tip-trigger');
      await copy.scrollIntoViewIfNeeded();
      await copy.hover();
      await page.waitForTimeout(600);
      assert((await page.locator('[role=tooltip]').count()) === 0, 'it showed before its delay');
      await page.waitForSelector('[role=tooltip]', { timeout: 3000 });
      const tip = page.locator('[role=tooltip]');
      assert(
        (await copy.getAttribute('aria-describedby')) === (await tip.getAttribute('id')),
        'not described',
      );
      const [tipBox, triggerBox] = [await tip.boundingBox(), await copy.boundingBox()];
      assert(tipBox.y + tipBox.height <= triggerBox.y, 'not above its trigger');
      // Once one has shown, the next shows at once.
      await page.locator('.tip-other').hover();
      await page.waitForFunction(
        () => document.querySelector('[role=tooltip]')?.textContent === 'Paste the link',
        null,
        { timeout: 400 },
      );
      // Escape hides it.
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[role=tooltip]'));
      // Focus from the keyboard shows it at once.
      await page.mouse.move(0, 0);
      await page.waitForTimeout(700);
      await copy.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await page.waitForFunction(
        () => document.querySelector('[role=tooltip]')?.textContent === 'Copy the link',
        null,
        { timeout: 400 },
      );
      await page.keyboard.press('Tab');
      await page.waitForFunction(
        () => document.querySelector('[role=tooltip]')?.textContent !== 'Copy the link',
      );
    },
  );

  await step(
    'Toast: comes in a landmark, F6 moves focus to it, and its close button gives focus back',
    async () => {
      await page.goto(`${url}/`);
      const notify = page.locator('.toast-trigger');
      await notify.scrollIntoViewIfNeeded();
      await notify.focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('[role=region][aria-label=Notifications] .toast');
      await page.waitForFunction(
        () => !document.querySelector('.toast')?.hasAttribute('data-enter'),
      );
      assert(
        (await page.locator('.toast [role=alert]').textContent()) === 'Link copied',
        'the content is not an alert',
      );
      await page.keyboard.press('F6');
      await page.waitForFunction(() => document.activeElement?.classList.contains('toast'));
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.querySelector('.toast'));
      await page.waitForFunction(() => document.activeElement?.classList.contains('toast-trigger'));
    },
  );

  await step(
    'Toast: closes after its timeout, which stops while the pointer is over it',
    async () => {
      await page.goto(`${url}/`);
      await page.locator('.toast-trigger').click();
      await page.waitForSelector('.toast');
      await page.locator('.toast').hover();
      await page.waitForTimeout(5500);
      assert(await page.locator('.toast').isVisible(), 'it closed while the pointer was over it');
      await page.mouse.move(0, 0);
      await page.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 7000 });
    },
  );

  await step(
    'PreviewTrigger: hover and keyboard focus show it, Tab moves in and past it, Escape gives focus back',
    async () => {
      await page.goto(`${url}/`);
      const author = page.locator('.author');
      await author.scrollIntoViewIfNeeded();
      await author.hover();
      await page.waitForTimeout(300);
      assert((await page.locator('.author-card').count()) === 0, 'it showed before its delay');
      await page.waitForSelector('.author-card', { timeout: 3000 });
      assert(
        await page.evaluate(() => !document.querySelector('main')?.closest('[inert]')),
        'the page is inert',
      );
      // The pointer moves onto the preview, which stays.
      await page.locator('.follow').hover();
      await page.waitForTimeout(400);
      assert(await page.locator('.author-card').isVisible(), 'it closed under the pointer');
      // The pointer goes elsewhere, and it hides.
      await page.mouse.move(1, 1);
      await page.waitForFunction(() => !document.querySelector('.author-card'));
      await page.waitForTimeout(700);
      // Keyboard focus shows it, Tab moves into it, and Tab past it moves on to the next link.
      await page.locator('.toast-trigger').focus();
      await author.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await page.waitForSelector('.author-card', { timeout: 3000 });
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.activeElement?.classList.contains('follow'));
      // Tab past its end moves on to the link after the trigger, and it hides.
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.activeElement?.classList.contains('reviewer'));
      await page.waitForFunction(() => !document.querySelector('.author-card'));
      await page.waitForTimeout(700);
      await page.keyboard.press('Shift+Tab');
      await page.waitForSelector('.author-card', { timeout: 3000 });
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.activeElement?.classList.contains('follow'));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.author-card'));
      await page.waitForFunction(() => document.activeElement?.classList.contains('author'));
    },
  );

  await step(
    'PreviewTrigger: a long press of a touch shows it, and the link does not navigate',
    async () => {
      await page.goto(`${url}/`);
      const author = page.locator('.author');
      await author.scrollIntoViewIfNeeded();
      const box = await author.boundingBox();
      const session = await page.context().newCDPSession(page);
      const point = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
      await page.waitForSelector('.author-card', { timeout: 3000 });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
      assert((await page.evaluate(() => location.hash)) !== '#author', 'the link navigated');
      await session.detach();
    },
  );

  await step(
    'ListBox: Tab, the arrow keys, typeahead, Space, Shift, and no scroll of the page',
    async () => {
      await page.goto(`${url}/`);
      const list = page.locator('.animals');
      await list.scrollIntoViewIfNeeded();
      const y = await page.evaluate(() => window.scrollY);
      await page.locator('#listbox').evaluate((heading) => heading.setAttribute('tabindex', '-1'));
      await page.locator('#listbox').focus();
      await page.keyboard.press('Tab');
      // The list passes its focus on to its first item.
      await page.waitForFunction(() => document.activeElement?.textContent === 'Aardvark');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Dog');
      assert((await page.evaluate(() => window.scrollY)) === y, 'the arrow keys scrolled the page');
      await page.keyboard.press('Space');
      await page.waitForFunction(
        () => document.querySelector('.animals-state')?.textContent === 'Dog',
      );
      // Typeahead moves to the item that starts with what is typed, across sections.
      await page.keyboard.type('pe');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Penguin');
      await page.keyboard.press('Shift+ArrowUp');
      await page.keyboard.press('Shift+ArrowUp');
      await page.waitForFunction(
        () => document.querySelector('.animals-state')?.textContent === 'Dog, Kangaroo',
      );
      // Tab leaves the list, and Shift+Tab comes back to the item that had focus.
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => !document.activeElement?.closest('.animals'));
      await page.keyboard.press('Shift+Tab');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Kangaroo');
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () => document.querySelector('.animals-state')?.textContent === 'None',
      );
    },
  );

  await step(
    'Menu: ArrowDown opens it, the arrow keys go round, a submenu opens and closes, and Enter acts',
    async () => {
      await page.goto(`${url}/`);
      const trigger = page.locator('.edit-trigger');
      await trigger.focus();
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Cut');
      const y = await page.evaluate(() => window.scrollY);
      // The arrow keys go round, past the disabled item, and never scroll the page.
      await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Share');
      assert((await page.evaluate(() => window.scrollY)) === y, 'the arrow keys scrolled the page');
      await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Copy');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Email');
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Share');
      assert((await page.locator('.share-menu').count()) === 0, 'the submenu stayed open');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Email');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.querySelector('.menu-state')?.textContent === 'messages',
      );
      await page.waitForFunction(() => document.querySelectorAll('.action-menu').length === 0);
      await page.waitForFunction(() => document.activeElement?.classList.contains('edit-trigger'));
      // A pointer that rests on the item opens the submenu, and another item closes it.
      await trigger.click();
      await page.locator('.share').hover();
      await page.waitForSelector('.share-menu', { timeout: 3000 });
      await page.locator('.action-menu >> text=Cut').first().hover();
      await page.waitForFunction(() => !document.querySelector('.share-menu'));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelectorAll('.action-menu').length === 0);
    },
  );

  await step(
    'Select: a required one stops its form, the arrow keys open it, and Enter picks an item',
    async () => {
      await page.goto(`${url}/`);
      await page.locator('.pet-send').click();
      // The browser checks the hidden input, and focus moves to the Button with the message.
      await page.waitForSelector('.pet-error');
      await page.waitForFunction(() => document.activeElement?.classList.contains('pet-trigger'));
      assert((await page.locator('.pet-state').textContent()) === 'Not sent', 'the form was sent');
      const y = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => document.activeElement?.textContent === 'Cat');
      assert((await page.evaluate(() => window.scrollY)) === y, 'ArrowDown scrolled the page');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement?.classList.contains('pet-trigger'));
      assert((await page.locator('.pet-trigger').textContent())?.trim() === 'Dog', 'no value');
      await page.waitForFunction(() => !document.querySelector('.pet-error'));
      await page.locator('.pet-send').click();
      await page.waitForFunction(() => document.querySelector('.pet-state')?.textContent === 'dog');
    },
  );

  await step(
    'ComboBox: typing filters, the arrow keys keep focus in the input, and Enter picks',
    async () => {
      await page.goto(`${url}/`);
      const input = page.locator('.city-input');
      await input.click();
      await page.keyboard.type('l');
      await page.waitForSelector('.city-list');
      // The items that contain "l": Berlin, Lisbon, London.
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('.city-list [role=option]')].filter((item) => !item.hidden)
            .length === 3,
      );
      await page.keyboard.type('o');
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('.city-list [role=option]')]
            .filter((item) => !item.hidden)
            .map((item) => item.textContent)
            .join() === 'London',
      );
      const y = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() =>
        document.activeElement?.getAttribute('aria-activedescendant'),
      );
      assert(
        await page.evaluate(() => document.activeElement?.classList.contains('city-input')),
        'focus left the input',
      );
      assert((await page.evaluate(() => window.scrollY)) === y, 'ArrowDown scrolled the page');
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.querySelector('.city-state')?.textContent === 'london',
      );
      assert((await input.inputValue()) === 'London', 'the input did not get the text');
      // The Button shows every item again, and a press picks one.
      await page.locator('.city-toggle').click();
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('.city-list [role=option]')].filter((item) => !item.hidden)
            .length === 5,
      );
      await page.locator('.city-list >> text=Madrid').click();
      await page.waitForFunction(
        () => document.querySelector('.city-state')?.textContent === 'madrid',
      );
      assert((await input.inputValue()) === 'Madrid', 'the press did not set the text');
    },
  );

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

  await step('Tabs: Tab stops at the selected tab, and the arrow keys select', async () => {
    await page.goto(`${url}/`);
    await page.locator('.planet-tab >> text=Mercury').focus();
    const y = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Venus');
    await page.waitForFunction(
      () => document.querySelector('.planet-panel')?.textContent === 'The hottest.',
    );
    assert((await page.evaluate(() => window.scrollY)) === y, 'the arrow keys scrolled the page');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Earth');
    // Tab moves on into the panel, and Shift+Tab comes back to the selected tab.
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.activeElement?.classList.contains('planet-panel'));
    await page.keyboard.press('Shift+Tab');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Earth');
    await page.locator('.planet-tab >> text=Mercury').click();
    await page.waitForFunction(
      () => document.querySelector('.planet-panel')?.textContent === 'The closest to the Sun.',
    );
    // The indicator is only in the selected tab, and it slides there from the last one.
    await page.locator('.planet-tab >> text=Venus').click();
    await page.waitForFunction(() => {
      const bars = document.querySelectorAll('.planet-bar');
      return bars.length === 1 && bars[0].closest('.planet-tab')?.textContent === 'Venus';
    });
    assert(
      await page.evaluate(() => document.querySelector('.planet-bar').getAnimations().length === 1),
      'the indicator did not move',
    );
  });

  await step('Tabs: an indicator with a timing function that has commas slides', async () => {
    await page.goto(`${url}/`);
    // The value of the .ui-indicator rule of the website.
    await page.addStyleTag({
      content:
        '.planet-bar { transition-duration: 0.25s; transition-timing-function: cubic-bezier(0.2, 0, 0, 1); }',
    });
    await page.locator('.planet-tab >> text=Mercury').click();
    await page.waitForFunction(
      () => document.querySelector('.planet-panel')?.textContent === 'The closest to the Sun.',
    );
    await page.locator('.planet-tab >> text=Venus').click();
    await page.waitForFunction(() => document.querySelector('.planet-bar')?.getAnimations().length);
    const easing = await page.evaluate(
      () => document.querySelector('.planet-bar').getAnimations()[0].effect.getTiming().easing,
    );
    assert(easing === 'cubic-bezier(0.2, 0, 0, 1)', `the indicator eases with ${easing}`);
  });

  await step('TagGroup: the arrow keys move between tags, and Delete removes one', async () => {
    await page.goto(`${url}/`);
    await page.locator('#taggroup').evaluate((heading) => heading.setAttribute('tabindex', '-1'));
    await page.locator('#taggroup').focus();
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.activeElement?.textContent?.startsWith('css'));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.textContent?.startsWith('html'));
    await page.keyboard.press('Delete');
    await page.waitForFunction(
      () => document.querySelector('.topic-state')?.textContent === 'css,js,svg',
    );
    // Focus moves on to the next tag.
    await page.waitForFunction(() => document.activeElement?.textContent?.startsWith('js'));
    await page.locator('.topic-remove').last().click();
    await page.waitForFunction(
      () => document.querySelector('.topic-state')?.textContent === 'css,js',
    );
  });

  await step(
    'GridList: rows with Up and Down, controls with Left and Right, and Tab leaves',
    async () => {
      await page.goto(`${url}/`);
      await page.locator('#gridlist').evaluate((heading) => heading.setAttribute('tabindex', '-1'));
      await page.locator('#gridlist').focus();
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.activeElement?.classList.contains('file-row'));
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => document.activeElement?.textContent?.includes('photos'));
      await page.keyboard.press('Space');
      await page.waitForFunction(
        () => document.querySelector('.file-state')?.textContent === 'photos / none',
      );
      // The grip, the box, then the button.
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.activeElement?.classList.contains('file-open'));
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.querySelector('.file-state')?.textContent === 'photos / photos',
      );
      // Tab leaves the list from its controls.
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => !document.activeElement?.closest('.file-grid'));
    },
  );

  await step('GridList: rows move with a drag of the pointer, and from the keys', async () => {
    await page.goto(`${url}/`);
    await page.waitForLoadState('load');
    await page.locator('.file-music').scrollIntoViewIfNeeded();
    // The pointer drags the last row to the top half of the first.
    await page.locator('.file-music').dragTo(page.locator('.file-notes'), {
      targetPosition: { x: 10, y: 2 },
    });
    await page.waitForFunction(
      () => document.querySelector('.file-order')?.textContent === 'music,notes,photos',
    );
    // The grip of a row starts a drag from the keys. Down chooses the place after the last row.
    await page.locator('.drag-music').focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('.file-music[data-dragging]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForSelector(".file-photos[data-drop-target='after']");
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => document.querySelector('.file-order')?.textContent === 'notes,photos,music',
    );
  });

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

  await step('Virtualizer: a long Tree renders the rows in view as it scrolls', async () => {
    await page.goto(`${url}/`);
    const box = page.locator('.many-box');
    await box.scrollIntoViewIfNeeded();
    // Only the rows in view render, of the 1000.
    await page.waitForFunction(() => document.querySelectorAll('.many-row').length < 30);
    await box.evaluate((element) => {
      element.scrollTop = 24 * 500;
    });
    await page.waitForFunction(() => document.querySelector('.many-many-500') !== null);
    assert((await page.locator('.many-many-0').count()) === 0, 'The first row still renders');
    const rows = await page.locator('.many-row').count();
    assert(rows < 30, `${rows} rows render`);
    // The spacers keep the height of the whole list.
    const height = await box.evaluate((element) => element.scrollHeight);
    assert(height >= 24 * 1000 - 24, `The list is ${height} pixels tall`);
  });

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

  await step(
    'NavigationTree: Tab through the links, Right opens, and the current page',
    async () => {
      await page.goto(`${url}/`);
      await page
        .locator('#navigation-tree')
        .evaluate((heading) => heading.setAttribute('tabindex', '-1'));
      await page.locator('#navigation-tree').focus();
      // The closed row that holds the current page is marked.
      assert(
        (await page.locator('.section-collections').getAttribute('data-current-ancestor')) !== null,
        'The row that holds the current page is not marked',
      );
      // The row without a link is no stop of Tab: Tab goes to the first link.
      await page.keyboard.press('Tab');
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('section-link-slider-link'),
      );
      await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('section-collections'),
      );
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.section-link-table-link') !== null);
      assert(
        (await page.locator('.section-link-table-link').getAttribute('aria-current')) === 'page',
        'The link of the current page has no aria-current',
      );
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('section-link-tree-link'),
      );
    },
  );

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

  await step('Tree: Right opens, Left closes and moves up, and the chevron toggles', async () => {
    await page.goto(`${url}/`);
    await page.locator('#tree').evaluate((heading) => heading.setAttribute('tabindex', '-1'));
    await page.locator('#tree').focus();
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.activeElement?.classList.contains('folder-src'));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(
      () => document.querySelector('.folder-state')?.textContent === 'src / None',
    );
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.classList.contains('folder-lib'));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('.folder-util') !== null);
    assert(
      (await page.locator('.folder-util').getAttribute('aria-level')) === '3',
      'The child of a child is not at level 3',
    );
    // Left closes the open row, then moves to the row that holds it.
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => document.querySelector('.folder-util') === null);
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => document.activeElement?.classList.contains('folder-src'));
    await page.keyboard.press('Space');
    await page.waitForFunction(
      () => document.querySelector('.folder-state')?.textContent === 'src / src',
    );
    // The chevron closes the row, and focus stays on the row.
    await page.locator('.folder-src .folder-chevron').click();
    await page.waitForFunction(() => document.querySelector('.folder-app') === null);
    await page.waitForFunction(() => document.activeElement?.classList.contains('folder-src'));
    // The tree data adds a file, which shows once its folder opens.
    await page.locator('.folder-add').click();
    await page.locator('.folder-src .folder-chevron').click();
    await page.waitForFunction(() => document.querySelector('.folder-main') !== null);
    assert(
      (await page.locator('.folder-main').getAttribute('aria-posinset')) === '3',
      'The added file is not the third in its folder',
    );
  });

  await step(
    'NumberField: the arrow keys, the wheel while focused, and a held Button',
    async () => {
      await page.goto(`${url}/`);
      const input = page.locator('.quantity-input');
      await input.focus();
      const y = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('ArrowUp');
      await page.waitForFunction(
        () => document.querySelector('.quantity-state')?.textContent === '2',
      );
      assert((await page.evaluate(() => window.scrollY)) === y, 'ArrowUp scrolled the page');
      // The wheel steps the number while the input has focus, and does not scroll the page.
      await input.hover();
      await page.mouse.wheel(0, 100);
      await page.waitForFunction(
        () => document.querySelector('.quantity-state')?.textContent === '3',
      );
      assert((await page.evaluate(() => window.scrollY)) === y, 'the wheel scrolled the page');
      // After focus leaves, the wheel scrolls the page again.
      await page
        .locator('#numberfield')
        .evaluate((heading) => heading.setAttribute('tabindex', '-1'));
      await page.locator('#numberfield').focus();
      await input.hover();
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(300);
      assert(
        (await page.locator('.quantity-state').textContent()) === '3',
        'the wheel stepped without focus',
      );
      // A held Button steps up to the maximum, and focus goes to the input.
      const plus = page.locator('.quantity-plus');
      const box = await plus.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForFunction(
        () => document.querySelector('.quantity-state')?.textContent === '5',
      );
      await page.mouse.up();
      assert(
        await page.evaluate(() => document.activeElement?.classList.contains('quantity-input')),
        'focus is not in the input',
      );
      // Typed text snaps into the range when focus leaves.
      await input.fill('9');
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.querySelector('.quantity-input')?.value === '5');
    },
  );

  await step(
    'Calendar: the keys move focus, a closed day cannot be picked, and the buttons stop at the minimum',
    async () => {
      await page.goto(`${url}/`);
      const cell = (date) =>
        page.locator(`.delivery-grid [data-date="${date}"]:not([data-outside-month])`);
      const waitState = (text) =>
        page.waitForFunction(
          (t) => document.querySelector('.delivery-state')?.textContent === t,
          text,
        );
      const waitFocus = (date) =>
        page.waitForFunction((d) => document.activeElement?.getAttribute('data-date') === d, date);
      await cell('2026-10-15').focus();
      await page.keyboard.press('ArrowRight');
      await waitFocus('2026-10-16');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await waitFocus('2026-10-18');
      // October 18 is a Sunday, when the shop is closed.
      assert(
        (await cell('2026-10-18').getAttribute('data-unavailable')) !== null,
        'Sunday is open',
      );
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowLeft');
      await waitFocus('2026-10-17');
      await page.keyboard.press('Enter');
      await waitState('2026-10-17');
      await page.locator('.delivery-next').click();
      await page.waitForFunction(
        () => document.querySelector('.delivery-heading')?.textContent === 'November 2026',
      );
      await cell('2026-11-03').click();
      await waitState('2026-11-03');
      await page.locator('.delivery-previous').click();
      await page.waitForFunction(
        () => document.querySelector('.delivery-heading')?.textContent === 'October 2026',
      );
      // The minimum is in October, so there is no month before it.
      await page.waitForFunction(() =>
        document.querySelector('.delivery-previous')?.hasAttribute('disabled'),
      );
    },
  );

  await step(
    'DateField: the arrow keys step a segment, digits type and move on, Backspace empties',
    async () => {
      await page.goto(`${url}/`);
      const segment = (type) => page.locator(`.birthday-input [data-type="${type}"]`);
      const waitState = (text) =>
        page.waitForFunction(
          (t) => document.querySelector('.birthday-state')?.textContent === t,
          text,
        );
      await segment('month').focus();
      await page.keyboard.press('ArrowUp');
      await waitState('2026-11-15');
      // The browser does not change the text of a segment, and the field types the digits.
      await page.keyboard.type('03');
      await waitState('2026-03-15');
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-type') === 'day');
      await page.keyboard.type('9');
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-type') === 'year',
      );
      await waitState('2026-03-09');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await waitState('none');
      assert(
        (await segment('year').textContent()) === 'yyyy',
        `the year shows ${await segment('year').textContent()}`,
      );
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-type') === 'day');
    },
  );

  await step(
    'TimeField: the arrow keys step the hour, digits type the minute, and p sets PM',
    async () => {
      await page.goto(`${url}/`);
      const segment = (type) => page.locator(`.pickup-input [data-type="${type}"]`);
      const waitState = (text) =>
        page.waitForFunction(
          (t) => document.querySelector('.pickup-state')?.textContent === t,
          text,
        );
      await segment('hour').focus();
      await page.keyboard.press('ArrowDown');
      await waitState('13:30');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.type('45');
      await waitState('13:45');
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-type') === 'dayPeriod',
      );
      await page.keyboard.type('a');
      await waitState('01:45');
      await page.keyboard.type('p');
      await waitState('13:45');
    },
  );

  await step(
    'DatePicker: the button opens the calendar on the date, the keys pick one, and focus comes back',
    async () => {
      await page.goto(`${url}/`);
      const waitState = (text) =>
        page.waitForFunction(
          (t) => document.querySelector('.departure-state')?.textContent === t,
          text,
        );
      const button = page.locator('.departure-button');
      await button.click();
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-date') === '2026-10-15',
      );
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-date') === '2026-10-16',
      );
      await page.keyboard.press('Enter');
      await waitState('2026-10-16');
      await page.waitForFunction(() => !document.querySelector('.departure-popover'));
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('departure-button'),
      );
      assert(
        (await page.locator('.departure-input [data-type="day"]').textContent()) === '16',
        'the segments do not show the picked date',
      );
      // Escape closes it without a pick.
      await button.click();
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-date') === '2026-10-16',
      );
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.departure-popover'));
      await waitState('2026-10-16');
    },
  );

  await step(
    'DateRangePicker: the end field steps, and two presses in the calendar pick a range that closes it',
    async () => {
      await page.goto(`${url}/`);
      const waitState = (text) =>
        page.waitForFunction(
          (t) => document.querySelector('.booking-state')?.textContent === t,
          text,
        );
      await page.locator('.booking-end [data-type="day"]').focus();
      await page.keyboard.press('ArrowUp');
      await waitState('2026-10-12 2026-10-16');
      await page.locator('.booking-button').click();
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-date') === '2026-10-12',
      );
      const cell = (date) =>
        page.locator(`.booking-grid [data-date="${date}"]:not([data-outside-month])`);
      await cell('2026-10-20').click();
      await cell('2026-10-22').click();
      await waitState('2026-10-20 2026-10-22');
      await page.waitForFunction(() => !document.querySelector('.booking-popover'));
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('booking-button'),
      );
      assert(
        (await page.locator('.booking-end [data-type="day"]').textContent()) === '22',
        'the end field does not show the picked end',
      );
    },
  );

  await step(
    'RangeCalendar: two presses pick a range, the pointer shows it, and a closed day stops it',
    async () => {
      await page.goto(`${url}/`);
      const cell = (date) =>
        page.locator(`.stay-grid [data-date="${date}"]:not([data-outside-month])`);
      const waitState = (text) =>
        page.waitForFunction((t) => document.querySelector('.stay-state')?.textContent === t, text);
      const selected = () =>
        page.evaluate(() =>
          [
            ...document.querySelectorAll('.stay-grid [data-selected]:not([data-outside-month])'),
          ].map((item) => item.getAttribute('data-date')),
        );
      await cell('2026-10-20').click();
      await cell('2026-10-22').hover();
      await page.waitForFunction(
        () =>
          document.querySelectorAll('.stay-grid [data-selected]:not([data-outside-month])')
            .length === 3,
      );
      assert(
        JSON.stringify(await selected()) === '["2026-10-20","2026-10-21","2026-10-22"]',
        `the range under the pointer is ${await selected()}`,
      );
      await cell('2026-10-22').click();
      await waitState('2026-10-20 2026-10-22');
      // October 25 is a Sunday, when the shop is closed, so a range over it is not picked. The
      // dates past it are out of reach once the range starts.
      await cell('2026-10-23').click();
      await page.waitForFunction(() =>
        document
          .querySelector('.stay-grid [data-date="2026-10-27"]:not([data-outside-month])')
          ?.hasAttribute('data-invalid'),
      );
      await cell('2026-10-27').click({ force: true });
      await page.waitForTimeout(100);
      assert(
        (await page.locator('.stay-state').textContent()) === '2026-10-20 2026-10-22',
        'a range over a closed day was picked',
      );
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () =>
          document.querySelectorAll('.stay-grid [data-selected]:not([data-outside-month])')
            .length === 3,
      );
    },
  );

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

  await step('ColorArea: the keys, a press on the area, and a drag from the thumb', async () => {
    await page.goto(`${url}/`);
    const state = () => page.locator('.plane-state').textContent();
    const waitState = async (text) => {
      try {
        await page.waitForFunction(
          (t) => document.querySelector('.plane-state')?.textContent === t,
          text,
          { timeout: 5000 },
        );
      } catch {
        throw new Error(`expected ${text}, got ${await state()}`);
      }
    };
    assert(
      (await page.locator('.plane').getAttribute('style')).includes('linear-gradient'),
      'the gradient of the area',
    );
    const inputs = page.locator('.plane-thumb input');
    assert((await inputs.count()) === 2, 'an input for each axis');
    // One tab stop: the input of y is out of the tab order and hidden from screen readers.
    assert((await inputs.nth(1).getAttribute('tabindex')) === '-1', 'y is out of the tab order');
    assert((await inputs.nth(1).getAttribute('aria-hidden')) === 'true', 'y is hidden');
    assert((await inputs.first().getAttribute('aria-hidden')) === null, 'x is not hidden');
    await inputs.first().focus();
    await page.keyboard.press('ArrowRight');
    await waitState('hsb(210, 51%, 80%)');
    // Up on the input of x moves y, and the focus follows it.
    await page.keyboard.press('ArrowUp');
    await waitState('hsb(210, 51%, 81%)');
    assert(
      await inputs.nth(1).evaluate((input) => document.activeElement === input),
      'the focus follows y',
    );
    await page.keyboard.press('PageDown');
    await waitState('hsb(210, 51%, 71%)');
    await page.keyboard.press('Shift+ArrowRight');
    await waitState('hsb(210, 61%, 71%)');
    await page.keyboard.press('Home');
    await waitState('hsb(210, 51%, 71%)');
    // A press at the middle is half of each channel.
    const area = await page.locator('.plane').boundingBox();
    await page.mouse.click(area.x + area.width * 0.5, area.y + area.height * 0.5);
    await waitState('hsb(210, 50%, 50%)');
    // A drag from the center of the thumb to the top right corner is the ends of both.
    const thumb = await page.locator('.plane-thumb').boundingBox();
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
    await page.mouse.down();
    await page.waitForSelector('.plane-thumb[data-dragging]');
    await page.mouse.move(area.x + area.width + 20, area.y - 20, { steps: 5 });
    await waitState('hsb(210, 100%, 100%)');
    await page.mouse.up();
    assert((await state()) === 'hsb(210, 100%, 100%)', await state());
  });

  await step('ColorWheel: the keys, a press on the ring, and a drag from the thumb', async () => {
    await page.goto(`${url}/`);
    const state = () => page.locator('.dial-state').textContent();
    const waitState = async (text) => {
      try {
        await page.waitForFunction(
          (t) => document.querySelector('.dial-state')?.textContent === t,
          text,
          { timeout: 5000 },
        );
      } catch {
        throw new Error(`expected ${text}, got ${await state()}`);
      }
    };
    assert((await page.locator('.dial-thumb input').inputValue()) === '210', 'the input');
    await page.locator('.dial-thumb input').focus();
    await page.keyboard.press('ArrowRight');
    await waitState('hsl(211, 100%, 50%)');
    // A page is to a multiple of 15.
    await page.keyboard.press('PageDown');
    await waitState('hsl(195, 100%, 50%)');
    await page.keyboard.press('Home');
    await waitState('hsl(0, 100%, 50%)');
    // The range input stops at 0, so the wheel wraps to 359.
    await page.keyboard.press('ArrowLeft');
    await waitState('hsl(359, 100%, 50%)');
    // A press on the ring below the center is 90 degrees. The middle of the ring is at 85.
    const track = await page.locator('.dial-track').boundingBox();
    const cx = track.x + track.width / 2;
    const cy = track.y + track.height / 2;
    await page.mouse.click(cx, cy + 85);
    await waitState('hsl(90, 100%, 50%)');
    // A press inside the ring does nothing, at another angle than the one before.
    await page.mouse.click(cx + 10, cy);
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert((await state()) === 'hsl(90, 100%, 50%)', `a press inside the ring: ${await state()}`);
    // A drag from the thumb to the left of the center is 180 degrees.
    await page.mouse.move(cx, cy + 85);
    await page.mouse.down();
    await page.waitForSelector('.dial-thumb[data-dragging]');
    await page.mouse.move(cx - 85, cy, { steps: 8 });
    await waitState('hsl(180, 100%, 50%)');
    await page.mouse.up();
    assert((await state()) === 'hsl(180, 100%, 50%)', await state());
  });

  await step(
    'ColorField: hex steps, a typed color commits on blur, and a channel steps in its format',
    async () => {
      await page.goto(`${url}/`);
      const waitText = async (selector, text) => {
        try {
          await page.waitForFunction(
            ([s, t]) => document.querySelector(s)?.textContent === t,
            [selector, text],
            { timeout: 5000 },
          );
        } catch {
          throw new Error(`expected ${text}, got ${await page.locator(selector).textContent()}`);
        }
      };
      const hex = page.locator('.accent-input');
      await hex.focus();
      const y = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('ArrowUp');
      await waitText('.accent-state', '#E2445B');
      assert((await page.evaluate(() => window.scrollY)) === y, 'ArrowUp scrolled the page');
      await page.keyboard.press('PageDown');
      await waitText('.accent-state', '#E2444B');
      // Typed text commits when focus leaves, and text that is not a color reverts.
      await hex.fill('369');
      await page.keyboard.press('Tab');
      await waitText('.accent-state', '#336699');
      assert((await hex.inputValue()) === '#336699', 'the hex is not formatted');
      await hex.focus();
      await hex.fill('#12');
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => document.querySelector('.accent-input').value === '#336699');
      await hex.focus();
      await hex.fill('');
      await page.keyboard.press('Tab');
      await waitText('.accent-state', 'None');
      // A channel field steps in the format of the channel.
      const shade = page.locator('.shade-input');
      assert((await shade.inputValue()) === '120°', await shade.inputValue());
      await shade.focus();
      await page.keyboard.press('PageUp');
      await waitText('.shade-state', 'hsl(135, 50%, 50%)');
      await page.waitForFunction(() => document.querySelector('.shade-input').value === '135°');
    },
  );

  await step(
    'ColorSwatchPicker: the keys select, Up and Down move by rows, and a disabled item is skipped',
    async () => {
      await page.goto(`${url}/`);
      const waitPaint = async (text) => {
        try {
          await page.waitForFunction(
            (t) => document.querySelector('.paint-state')?.textContent === t,
            text,
            { timeout: 5000 },
          );
        } catch {
          throw new Error(
            `expected ${text}, got ${await page.locator('.paint-state').textContent()}`,
          );
        }
      };
      // Focus goes to the selected item, and the arrow keys select the next.
      await page.locator('.paint').focus();
      await page.waitForFunction(() => document.activeElement?.classList.contains('paint-red'));
      await page.keyboard.press('ArrowRight');
      await waitPaint('rgb(46, 160, 67)');
      await page.keyboard.press('End');
      await waitPaint('hsl(217, 91%, 53%)');
      // The items wrap in two rows. Up goes to the item above, and Down back, in a real layout.
      await page.keyboard.press('ArrowUp');
      await waitPaint('#e2445a');
      await page.keyboard.press('ArrowDown');
      await waitPaint('hsl(217, 91%, 53%)');
      // The last item is disabled, so End skipped it, and Down from the blue one stays.
      await page.keyboard.press('ArrowDown');
      assert(
        (await page.evaluate(() => document.activeElement?.className)).includes('paint-blue'),
        'Down left the item',
      );
      // The keys and a click on a disabled item select nothing.
      await page.locator('.paint-gray').evaluate((element) => element.focus());
      await page.keyboard.press('Space');
      await page.keyboard.press('Enter');
      // Playwright does not press an element that is aria-disabled, so the press is forced.
      await page.locator('.paint-gray').click({ force: true });
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert(
        (await page.locator('.paint-state').textContent()) === 'hsl(217, 91%, 53%)',
        'disabled',
      );
      assert(
        (await page.locator('.paint-gray').getAttribute('aria-selected')) === 'false',
        'the disabled item is selected',
      );
      // A press selects the item with its own format.
      await page.locator('.paint-red').click();
      await waitPaint('#e2445a');
      assert(
        (await page.locator('.paint-red').getAttribute('aria-selected')) === 'true',
        'the pressed item is not selected',
      );
    },
  );

  await step('ColorPicker: a change in the area shows in the field and the swatch', async () => {
    await page.goto(`${url}/`);
    const field = page.locator('.mix-input');
    const swatch = () =>
      page
        .locator('.mix-swatch')
        .evaluate((element) => getComputedStyle(element).getPropertyValue('--color').trim());
    const before = await swatch();
    const text = await field.inputValue();
    assert(/^#[0-9A-F]{6}$/.test(text), `the field shows hex, got ${text}`);
    await page.locator('.mix-area input').first().focus();
    // End moves x a page, as in React Aria.
    await page.keyboard.press('End');
    try {
      await page.waitForFunction(
        () => document.querySelector('.mix-state')?.textContent === 'hsb(210, 60%, 80%)',
        undefined,
        { timeout: 5000 },
      );
    } catch {
      throw new Error(`got ${await page.locator('.mix-state').textContent()}`);
    }
    await page.waitForFunction((old) => document.querySelector('.mix-input').value !== old, text, {
      timeout: 5000,
    });
    assert((await swatch()) !== before, 'the swatch did not change');
  });

  await step('axe-core: an open menu has no violations', async () => {
    await page.goto(`${url}/`);
    await page.locator('.edit-trigger').focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Cut');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Email');
    await page.addScriptTag({ path: axe });
    const violations = await page.evaluate(async () => {
      // An open menu is modal, as in React Aria, so the rest of the page is inert. axe skips its
      // rules of the whole page while a dialog is open, but a menu is not a dialog, so the rules
      // that look for the main landmark, the first heading and content outside landmarks are
      // off here alone.
      const result = await window.axe.run(document, {
        rules: {
          'landmark-one-main': { enabled: false },
          'page-has-heading-one': { enabled: false },
          region: { enabled: false },
        },
      });
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });

  await step('axe-core: an open select has no violations', async () => {
    await page.goto(`${url}/`);
    await page.locator('.pet-trigger').focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Cat');
    await page.addScriptTag({ path: axe });
    const violations = await page.evaluate(async () => {
      // As for a menu: the list of a select is modal and not a dialog, so axe's rules of the
      // whole page see the inert page. They are off here alone.
      const result = await window.axe.run(document, {
        rules: {
          'landmark-one-main': { enabled: false },
          'page-has-heading-one': { enabled: false },
          region: { enabled: false },
        },
      });
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });

  await step('axe-core: an open combobox has no violations', async () => {
    await page.goto(`${url}/`);
    await page.locator('.city-input').click();
    await page.keyboard.type('l');
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-activedescendant'));
    await page.addScriptTag({ path: axe });
    const violations = await page.evaluate(async () => {
      // The list renders at the end of <body>, outside the landmarks, as in React Aria, so the
      // rule "region" is off here alone. The list is not modal, so the page keeps its landmarks.
      const result = await window.axe.run(document, { rules: { region: { enabled: false } } });
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });

  await step('axe-core: a tooltip, a toast and a preview have no violations', async () => {
    await page.goto(`${url}/`);
    await page.locator('.toast-trigger').click();
    await page.waitForSelector('.toast');
    await page.locator('.author').hover();
    await page.waitForSelector('.author-card', { timeout: 3000 });
    await page.locator('.tip-trigger').hover();
    await page.waitForSelector('[role=tooltip]', { timeout: 3000 });
    await page.addScriptTag({ path: axe });
    const violations = await page.evaluate(async () => {
      // A tooltip renders at the end of <body>, outside the landmarks, as in React Aria. The
      // best-practice rule "region" asks for all text in landmarks, so it is off here alone.
      const result = await window.axe.run(document, { rules: { region: { enabled: false } } });
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });

  await step('axe-core: an open modal has no violations', async () => {
    await page.goto(`${url}/`);
    await page.locator('.delete-trigger').click();
    await page.waitForFunction(() => document.activeElement?.classList.contains('confirm'));
    await page.addScriptTag({ path: axe });
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document);
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });

  await step('axe-core: an open popover has no violations', async () => {
    await page.goto(`${url}/`);
    await page.locator('.settings-trigger').click();
    await page.waitForFunction(() => document.activeElement?.classList.contains('settings'));
    await page.addScriptTag({ path: axe });
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document);
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });

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
