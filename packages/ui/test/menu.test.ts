// The tests of Menu.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Menus from './fixtures/menus.brm?brumate-server';
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

async function menus() {
  const page = await mount(Menus, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof menus>>;

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

/** Opens the actions menu with a key on its trigger, and waits for focus on an item. */
async function openWith(page: Page, key: string, item: string) {
  const trigger = page.get('.trigger');
  trigger.focus();
  press(key, trigger);
  await page.waitFor(() => expect(find('.menu')).not.toBeNull());
  await page.waitFor(() => expect(document.activeElement).toBe(find(item)));
}

it('links the trigger to the menu, and names the menu by it', async () => {
  const page = await menus();
  const trigger = page.get('.trigger');
  expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  await openWith(page, 'ArrowDown', '.item-new');
  const menu = find('.menu')!;
  expect(menu.getAttribute('role')).toBe('menu');
  expect(menu.getAttribute('aria-labelledby')).toBe(trigger.id);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(trigger.getAttribute('aria-controls')).toBe(find('.popover')!.id);
  expect(find('.copy')!.getAttribute('role')).toBe('menuitem');
  expect(find('.copy')!.hasAttribute('aria-checked')).toBe(false);
  expect(find('.delete')!.getAttribute('aria-disabled')).toBe('true');
});

it('opens at the first item with ArrowDown, and at the last with ArrowUp', async () => {
  const page = await menus();
  await openWith(page, 'ArrowUp', '.share');
  press('Escape', document.activeElement);
  await page.waitFor(() => expect(find('.menu')).toBeNull());
  expect(document.activeElement).toBe(page.get('.trigger'));
  await openWith(page, 'ArrowDown', '.item-new');
});

it('focuses the menu after a press with a pointer, and the arrow keys move to an item', async () => {
  const page = await menus();
  pressWith(page.get('.trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.menu')));
  press('ArrowDown', find('.menu')!);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.item-new')));
});

it('moves focus with the arrow keys, round the ends, past disabled items, and by typing', async () => {
  const page = await menus();
  await openWith(page, 'ArrowDown', '.item-new');
  press('ArrowUp');
  await page.waitFor(() => expect(document.activeElement).toBe(find('.share')));
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(find('.item-new')));
  press('End');
  press('ArrowUp');
  // Delete is disabled, so focus skips it.
  await page.waitFor(() => expect(document.activeElement).toBe(find('.cut')));
  press('Home');
  await page.waitFor(() => expect(document.activeElement).toBe(find('.item-new')));
  press('c');
  await page.waitFor(() => expect(document.activeElement).toBe(find('.copy')));
  press('u');
  await page.waitFor(() => expect(document.activeElement).toBe(find('.cut')));
});

it('acts on an item with Enter, and closes, giving focus back to the trigger', async () => {
  const page = await menus();
  await openWith(page, 'ArrowDown', '.item-new');
  press('ArrowDown');
  press('Enter');
  await page.waitFor(() => expect(find('.menu')).toBeNull());
  await page.waitFor(() => expect(state(page)[0]).toEqual(['open']));
  expect(state(page)[1]).toBe(false);
  expect(document.activeElement).toBe(page.get('.trigger'));
});

it('acts on an item with a press, and not on a disabled one', async () => {
  const page = await menus();
  await openWith(page, 'ArrowDown', '.item-new');
  pressWith(find('.delete')!);
  pressWith(find('.copy')!);
  await page.waitFor(() => expect(find('.menu')).toBeNull());
  expect(state(page)[0]).toEqual(['copy']);
});

it('moves focus to the item under the pointer', async () => {
  const page = await menus();
  await openWith(page, 'ArrowDown', '.item-new');
  pointer('pointerenter', find('.cut')!);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.cut')));
});

it('closes on Tab', async () => {
  const page = await menus();
  await openWith(page, 'ArrowDown', '.item-new');
  press('Tab');
  await page.waitFor(() => expect(find('.menu')).toBeNull());
  expect(state(page)[1]).toBe(false);
});

it('checks one item of a single selection, and closes', async () => {
  const page = await menus();
  const trigger = page.get('.format-trigger');
  trigger.focus();
  press('ArrowDown', trigger);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.left')));
  expect(find('.left')!.getAttribute('role')).toBe('menuitemradio');
  expect(find('.left')!.getAttribute('aria-checked')).toBe('true');
  expect(find('.center')!.getAttribute('aria-checked')).toBe('false');
  press('ArrowDown');
  press(' ');
  await page.waitFor(() => expect(find('.align')).toBeNull());
  expect(state(page)[2]).toEqual(['center']);
});

it('checks and unchecks items of a multiple selection, and stays open', async () => {
  const page = await menus();
  const styles = page.get('.styles');
  expect(styles.getAttribute('tabindex')).toBe('0');
  expect(page.get('.text-section').getAttribute('aria-labelledby')).toBe(
    page.get('.text-header').id,
  );
  styles.focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.bold')));
  expect(page.get('.bold').getAttribute('role')).toBe('menuitemcheckbox');
  press('Enter');
  press('ArrowDown');
  press('Enter');
  await page.waitFor(() => expect(state(page)[3]).toEqual(['bold', 'italic']));
  press('Enter');
  await page.waitFor(() => expect(state(page)[3]).toEqual(['bold']));
  expect(page.get('.bold').getAttribute('aria-checked')).toBe('true');
  expect(page.get('.italic').getAttribute('aria-checked')).toBe('false');
  // While an item has focus, Tab leaves the menu instead of stopping at it.
  expect(styles.tabIndex).toBe(-1);
});

it('opens a submenu with ArrowRight, and closes it with ArrowLeft', async () => {
  const page = await menus();
  await openWith(page, 'ArrowUp', '.share');
  const share = find('.share')!;
  expect(share.getAttribute('aria-haspopup')).toBe('menu');
  expect(share.getAttribute('aria-expanded')).toBe('false');
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(find('.email')));
  expect(share.getAttribute('aria-expanded')).toBe('true');
  // The submenu is not modal, so the parent menu stays usable.
  expect(find('.menu')!.closest('[inert]')).toBeNull();
  press('ArrowLeft');
  await page.waitFor(() => expect(find('.submenu')).toBeNull());
  expect(document.activeElement).toBe(share);
  expect(find('.menu')).not.toBeNull();
});

it('closes every menu after an action in a submenu', async () => {
  const page = await menus();
  await openWith(page, 'ArrowUp', '.share');
  press('Enter');
  await page.waitFor(() => expect(document.activeElement).toBe(find('.email')));
  press('ArrowDown');
  press('Enter');
  await page.waitFor(() => expect(find('.menu')).toBeNull());
  expect(find('.submenu')).toBeNull();
  // The parent menu closes too, with its `onClose`.
  expect(state(page)[0]).toEqual(['sms']);
  expect(state(page)[4]).toBe(1);
  expect(state(page)[1]).toBe(false);
});

it('opens a submenu when the pointer rests on its item, and closes it for another item', async () => {
  const page = await menus();
  await openWith(page, 'ArrowDown', '.item-new');
  pointer('pointerenter', find('.share')!);
  await page.waitFor(() => expect(find('.submenu')).not.toBeNull());
  // Focus stays on the item, as the pointer put it there.
  await page.waitFor(() => expect(document.activeElement).toBe(find('.share')));
  pointer('pointerleave', find('.share')!);
  pointer('pointerenter', find('.cut')!);
  await page.waitFor(() => expect(find('.submenu')).toBeNull());
  await page.waitFor(() => expect(document.activeElement).toBe(find('.cut')));
});
