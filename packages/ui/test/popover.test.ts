// The tests of Popover and Dialog follow the tests of Popover, Dialog and DialogTrigger in
// React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Popovers from './fixtures/popovers.brm?brumate-server';
import { pointer, press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  // A portal renders outside the mounted container, which unmount removes.
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
  for (const element of document.querySelectorAll('[inert]')) {
    element.removeAttribute('inert');
  }
});

async function popovers() {
  const page = await mount(Popovers, {});
  unmount = page.unmount;
  return page;
}

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

async function open(page: Awaited<ReturnType<typeof popovers>>) {
  pressWith(page.get('.trigger'));
  await page.waitFor(() => expect(find('.popover')).not.toBeNull());
  await page.waitFor(() => expect(document.activeElement).toBe(find('.dialog')));
}

it('links the trigger to the popover, and renders nothing while it is closed', async () => {
  const page = await popovers();
  const trigger = page.get('.trigger');
  expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(find('.popover')).toBeNull();
});

it('opens at the end of the page, names its dialog, and moves focus into it', async () => {
  const page = await popovers();
  await open(page);
  const popover = find('.popover')!;
  const trigger = page.get('.trigger');
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(trigger.getAttribute('aria-controls')).toBe(popover.id);
  // The layer of the popover is at the end of <body>, outside the page.
  const layer = popover.closest('[data-layer]')!;
  expect(layer.parentElement).toBe(document.body);
  expect(page.get('.page').contains(popover)).toBe(false);
  const dialog = find('.dialog')!;
  expect(dialog.getAttribute('role')).toBe('dialog');
  expect(dialog.getAttribute('aria-labelledby')).toBe(dialog.querySelector('h3')!.id);
  expect(popover.style.position).toBe('fixed');
  expect(popover.querySelector('.arrow')!.getAttribute('aria-hidden')).toBe('true');
  // The page writes the bound state once its own code has loaded.
  await page.waitFor(() => expect(page.text('.state')).toBe('true'));
});

it('makes the rest of the page inert while it is open, and gives it back', async () => {
  const page = await popovers();
  await open(page);
  expect(page.get('.page').closest('[inert]')).not.toBeNull();
  press('Escape', find('.dialog')!);
  await page.waitFor(() => expect(find('.popover')).toBeNull());
  expect(page.get('.page').closest('[inert]')).toBeNull();
});

it('closes on Escape and gives focus back to its trigger', async () => {
  const page = await popovers();
  await open(page);
  press('Escape', find('.dialog')!);
  await page.waitFor(() => expect(find('.popover')).toBeNull());
  expect(document.activeElement).toBe(page.get('.trigger'));
  expect(page.text('.state')).toBe('false');
});

it('closes with a Button of the close slot', async () => {
  const page = await popovers();
  await open(page);
  pressWith(find('.close')!);
  await page.waitFor(() => expect(find('.popover')).toBeNull());
});

it('closes on a press outside, and a press on its trigger toggles it once', async () => {
  const page = await popovers();
  await open(page);
  pointer('pointerdown', document.body);
  await page.waitFor(() => expect(find('.popover')).toBeNull());
  await open(page);
  // The trigger is not outside, so its press closes the popover and does not open it again.
  pressWith(page.get('.trigger'));
  await page.waitFor(() => expect(find('.popover')).toBeNull());
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(find('.popover')).toBeNull();
});

it('keeps Tab inside, and prevents it before the code loads', async () => {
  const page = await popovers();
  await open(page);
  const name = find('.name')!;
  name.focus();
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  name.dispatchEvent(tab);
  expect(tab.defaultPrevented).toBe(true);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.inner-trigger')));
  find('.close')!.focus();
  press('Tab', find('.close')!);
  // Past the last element, focus wraps to the first.
  await page.waitFor(() => expect(document.activeElement).toBe(name));
});

it('opens a popover inside the layer of the popover around it', async () => {
  const page = await popovers();
  await open(page);
  pressWith(find('.inner-trigger')!);
  await page.waitFor(() => expect(find('.inner-popover')).not.toBeNull());
  const outerLayer = find('.popover')!.closest('[data-layer]')!;
  const innerLayer = find('.inner-popover')!.closest('[data-layer]')!;
  // The inner layer is at the end of the outer one, after its panel.
  expect(innerLayer.parentElement?.closest('[data-layer]')).toBe(outerLayer);
  // A press in the inner popover is inside the outer one, so the outer one stays open.
  pointer('pointerdown', find('.inner-button')!);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(find('.popover')).not.toBeNull();
  // Escape closes only the inner one.
  press('Escape', find('.inner-dialog')!);
  await page.waitFor(() => expect(find('.inner-popover')).toBeNull());
  expect(find('.popover')).not.toBeNull();
});

it('runs the steps of a transition with transition, and leaves the page alone when non-modal', async () => {
  const page = await popovers();
  const flags: string[] = [];
  new MutationObserver(() => {
    const fade = find('.fade');
    if (fade) {
      flags.push(
        ['data-closed', 'data-enter', 'data-leave', 'inert']
          .filter((name) => fade.hasAttribute(name))
          .join(' '),
      );
    }
  }).observe(document.body, { attributes: true, childList: true, subtree: true });
  pressWith(page.get('.fade-trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.fade-dialog')));
  expect(flags).toContain('data-closed data-enter');
  expect(find('.fade')!.hasAttribute('data-closed')).toBe(false);
  // A non-modal popover leaves the page as it is.
  expect(page.get('.page').closest('[inert]')).toBeNull();
  press('Escape', find('.fade-dialog')!);
  await page.waitFor(() => expect(find('.fade')).toBeNull());
  expect(flags.some((step) => step.includes('data-leave') && step.includes('inert'))).toBe(true);
});

it('brings focus back when it lands on nothing or outside, while it is modal', async () => {
  const page = await popovers();
  await open(page);
  const name = find('.name')!;
  name.focus();
  await page.waitFor(() => expect(document.activeElement).toBe(name));
  // The focused element leaves, so focus lands on <body>.
  name.blur();
  await page.waitFor(() => expect(document.activeElement).toBe(name));
  // Code that focuses an element outside: an inert one cannot take it, and focus comes back.
  find('.outside')!.focus();
  expect(document.activeElement).toBe(name);
});

it('gives back what it held when it leaves the page while it is open', async () => {
  const page = await popovers();
  pressWith(page.get('.removable-trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.removable-dialog')));
  expect(page.get('.page').closest('[inert]')).not.toBeNull();
  // Something else removes the whole trigger, with the open popover in it.
  find('.remove')!.click();
  await page.waitFor(() => expect(find('.removable')).toBeNull());
  await page.waitFor(() => expect(page.get('.page').closest('[inert]')).toBeNull());
});

it('gives focus to the trigger found by its ID, when the element that had it is gone', async () => {
  const page = await popovers();
  await open(page);
  // The trigger renders again: a new element with the same ID.
  const trigger = page.get('.trigger');
  const copy = trigger.cloneNode(true) as HTMLElement;
  trigger.replaceWith(copy);
  press('Escape', find('.dialog')!);
  await page.waitFor(() => expect(find('.popover')).toBeNull());
  expect(document.activeElement).toBe(copy);
});

it('moves the start of Tab to where the selection was, when nothing had focus', async () => {
  const page = await popovers();
  (document.activeElement as HTMLElement | null)?.blur();
  const text = page.get('.text');
  window.getSelection()!.selectAllChildren(text);
  const focused: Element[] = [];
  text.addEventListener('focus', () => focused.push(text));
  // A shortcut opens it, with nothing focused.
  find('.shortcut')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await page.waitFor(() => expect(find('.shortcut-dialog')).not.toBeNull());
  press('Escape', find('.shortcut-dialog')!);
  await page.waitFor(() => expect(find('.shortcut-popover')).toBeNull());
  // It took focus for a moment, so Tab moves on from it, and gave it up.
  expect(focused).toEqual([text]);
  expect(text.hasAttribute('tabindex')).toBe(false);
  expect(document.activeElement).not.toBe(text);
});
