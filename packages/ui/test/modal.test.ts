// The tests of ModalOverlay, Modal and Sheet follow the tests of Modal in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import { lockScroll } from '../src/overlay.ts';
import Modals from './fixtures/modals.brm?brumate-server';
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
  document.documentElement.removeAttribute('style');
});

async function modals() {
  const page = await mount(Modals, {});
  unmount = page.unmount;
  return page;
}

const find = (selector: string) => document.querySelector<HTMLElement>(selector);
const root = document.documentElement;

async function open(page: Awaited<ReturnType<typeof modals>>) {
  pressWith(page.get('.trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.dialog')));
}

it('renders nothing while it is closed, and links its trigger', async () => {
  const page = await modals();
  expect(page.get('.trigger').hasAttribute('aria-haspopup')).toBe(false);
  expect(find('.overlay')).toBeNull();
  expect(find('.modal')).toBeNull();
});

it('covers the page at the end of <body>, locks it, and gives it back', async () => {
  const page = await modals();
  await open(page);
  const overlay = find('.overlay')!;
  expect(overlay.closest('[data-layer]')!.parentElement).toBe(document.body);
  expect(overlay.style.position).toBe('fixed');
  expect(overlay.style.getPropertyValue('--visual-viewport-height')).toMatch(/px$/);
  expect(page.get('.trigger').getAttribute('aria-controls')).toBe(overlay.id);
  expect(find('.modal')!.parentElement).toBe(overlay);
  expect(find('.dialog')!.getAttribute('aria-labelledby')).toBe(find('.dialog h3')!.id);
  // The page is inert, and does not scroll.
  expect(page.get('.page').closest('[inert]')).not.toBeNull();
  expect(root.style.overflow).toBe('hidden');
  pressWith(find('.close')!);
  await page.waitFor(() => expect(find('.overlay')).toBeNull());
  expect(page.get('.page').closest('[inert]')).toBeNull();
  expect(root.style.overflow).toBe('');
  expect(document.activeElement).toBe(page.get('.trigger'));
  await page.waitFor(() => expect(page.text('.state')).toBe('false false'));
});

it('closes on Escape, unless isKeyboardDismissDisabled', async () => {
  const page = await modals();
  await open(page);
  press('Escape', find('.dialog')!);
  await page.waitFor(() => expect(find('.overlay')).toBeNull());
  pressWith(page.get('.alert-trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.alert-dialog')));
  press('Escape', find('.alert-dialog')!);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(find('.alert')).not.toBeNull();
  pressWith(find('.alert-close')!);
  await page.waitFor(() => expect(find('.alert')).toBeNull());
});

it('closes on a press on the overlay only with isDismissable', async () => {
  const page = await modals();
  await open(page);
  const overlay = find('.overlay')!;
  pointer('pointerdown', overlay);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(find('.overlay')).not.toBeNull();
  press('Escape', find('.dialog')!);
  await page.waitFor(() => expect(find('.overlay')).toBeNull());
  // A Modal on its own renders its overlay.
  pressWith(page.get('.light-trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.light-dialog')));
  const lightOverlay = find('.light')!.parentElement!;
  expect(lightOverlay.hasAttribute('data-modal-overlay')).toBe(true);
  // A press in the Modal is not outside.
  pointer('pointerdown', find('.light-dialog')!);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(find('.light')).not.toBeNull();
  pointer('pointerdown', lightOverlay);
  await page.waitFor(() => expect(find('.light')).toBeNull());
});

it('keeps Tab inside', async () => {
  const page = await modals();
  await open(page);
  const close = find('.close')!;
  close.focus();
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  close.dispatchEvent(tab);
  expect(tab.defaultPrevented).toBe(true);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.name')));
});

it('opens a popover in its layer, which Escape closes alone', async () => {
  const page = await modals();
  await open(page);
  pressWith(find('.inner-trigger')!);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.inner-dialog')));
  const layer = find('.overlay')!.closest('[data-layer]')!;
  expect(
    find('.inner-popover')!.closest('[data-layer]')!.parentElement?.closest('[data-layer]'),
  ).toBe(layer);
  // The popover is not inert, and a press in it is not on the overlay.
  expect(find('.inner-button')!.closest('[inert]')).toBeNull();
  pointer('pointerdown', find('.inner-button')!);
  press('Escape', find('.inner-dialog')!);
  await page.waitFor(() => expect(find('.inner-popover')).toBeNull());
  expect(find('.overlay')).not.toBeNull();
  expect(root.style.overflow).toBe('hidden');
});

it('runs the steps of a transition on the overlay', async () => {
  const page = await modals();
  const flags: string[] = [];
  new MutationObserver(() => {
    const overlay = find('.alert')?.parentElement;
    if (overlay) {
      flags.push(
        ['data-closed', 'data-enter', 'data-leave', 'inert']
          .filter((name) => overlay.hasAttribute(name))
          .join(' '),
      );
    }
  }).observe(document.body, { attributes: true, childList: true, subtree: true });
  pressWith(page.get('.alert-trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.alert-dialog')));
  expect(flags).toContain('data-closed data-enter');
  pressWith(find('.alert-close')!);
  await page.waitFor(() => expect(find('.alert')).toBeNull());
  expect(flags.some((step) => step.includes('data-leave') && step.includes('inert'))).toBe(true);
});

it('opens a Sheet from its own state, on the start side, and closes it on a press outside', async () => {
  const page = await modals();
  page.get('.sheet-trigger').click();
  await page.waitFor(() => expect(document.activeElement).toBe(find('.sheet-dialog')));
  const sheet = find('.sheet')!;
  expect(sheet.hasAttribute('data-sheet')).toBe(true);
  expect(sheet.getAttribute('data-side')).toBe('left');
  await page.waitFor(() => expect(page.text('.state')).toBe('false true'));
  pointer('pointerdown', sheet.parentElement!);
  await page.waitFor(() => expect(find('.sheet')).toBeNull());
  await page.waitFor(() => expect(page.text('.state')).toBe('false false'));
});

it('shares one lock of the scroll between nested overlays', () => {
  root.style.overflow = 'auto';
  const first = lockScroll();
  const second = lockScroll();
  expect(root.style.overflow).toBe('hidden');
  first();
  first();
  expect(root.style.overflow).toBe('hidden');
  second();
  expect(root.style.overflow).toBe('auto');
});

it('pads the root by the width of the scrollbar that the lock hides', () => {
  // The root shows a scrollbar 15 pixels wide.
  Object.defineProperty(root, 'clientWidth', {
    configurable: true,
    get: () => window.innerWidth - 15,
  });
  try {
    const unlock = lockScroll();
    expect(root.style.paddingRight).toBe('15px');
    unlock();
    expect(root.style.paddingRight).toBe('');
  } finally {
    delete (root as unknown as Record<string, unknown>).clientWidth;
  }
});
