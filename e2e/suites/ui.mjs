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
