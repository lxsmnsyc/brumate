// The tests of a MenuTrigger with trigger="contextmenu", and of the shortcut of a DialogTrigger.
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Page from './fixtures/context-menus.brm?brumate-server';
import { computePosition, pointAnchor } from '../src/position.ts';
import { pointer, press } from './interact.ts';

let unmount: (() => void) | undefined;
// unmount does not run the cleanups of a page, so the keydown listeners of the page are taken off here.
const keydowns: EventListenerOrEventListenerObject[] = [];
const addListener = document.addEventListener.bind(document);
document.addEventListener = ((
  type: string,
  listener: EventListenerOrEventListenerObject,
  ...rest: unknown[]
) => {
  if (type === 'keydown' && rest.length === 0) {
    keydowns.push(listener);
  }
  return (addListener as (...args: unknown[]) => void)(type, listener, ...rest);
}) as typeof document.addEventListener;
afterEach(() => {
  unmount?.();
  for (const listener of keydowns.splice(0)) {
    document.removeEventListener('keydown', listener);
  }
  Reflect.deleteProperty(document.documentElement, 'clientWidth');
  Reflect.deleteProperty(document.documentElement, 'clientHeight');
  // A portal renders outside the mounted container, which unmount removes.
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
  for (const element of document.querySelectorAll('[inert]')) {
    element.removeAttribute('inert');
  }
});

async function mounted() {
  // happy-dom has no size, so a menu would be clamped to the padding of its popover.
  Object.defineProperty(document.documentElement, 'clientWidth', {
    value: 1000,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: 800,
    configurable: true,
  });
  const page = await mount(Page, {});
  unmount = page.unmount;
  // The shortcut listens once the page has loaded.
  await page.waitFor(() => expect(page.text('.ready')).toBe('ready'));
  await new Promise((done) => setTimeout(done, 100));
  return page;
}

type PageResult = Awaited<ReturnType<typeof mounted>>;

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

function state(page: PageResult) {
  return JSON.parse(page.text('.state')) as [unknown[], number, number];
}

/** Sends a right click to an element, as a browser does: pointerdown, then contextmenu. */
function rightClick(target: Element, x = 40, y = 60): MouseEvent {
  pointer('pointerdown', target, { button: 2, clientX: x, clientY: y });
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: x,
    clientY: y,
  });
  target.dispatchEvent(event);
  return event;
}

it('opens the menu at the pointer on a right click, and keeps the menu of the browser away', async () => {
  const page = await mounted();
  const area = page.get('.area');
  area.focus();
  const event = rightClick(area, 40, 60);
  expect(event.defaultPrevented).toBe(true);
  await page.waitFor(() => expect(find('.menu')).not.toBeNull());
  const popover = find('.popover')!;
  await page.waitFor(() => expect(popover.style.left).toBe('40px'));
  expect(popover.style.top).toBe('60px');
  expect(find('.menu')!.getAttribute('role')).toBe('menu');
  // Opened by a pointer, so the menu has focus and an arrow key moves to an item.
  await page.waitFor(() => expect(document.activeElement).toBe(find('.menu')));
  press('ArrowDown', find('.menu')!);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.cut')));
  // A menu that nothing names would point at a trigger that is not there.
  expect(find('.menu')!.getAttribute('aria-labelledby')).toBeNull();
});

it('gives focus back on Escape', async () => {
  const page = await mounted();
  const area = page.get('.area');
  area.focus();
  rightClick(area);
  await page.waitFor(() => expect(find('.menu')).not.toBeNull());
  await page.waitFor(() => expect(document.activeElement).toBe(find('.menu')));
  press('Escape', find('.menu')!);
  await page.waitFor(() => expect(find('.menu')).toBeNull());
  expect(document.activeElement).toBe(area);
});

it('acts on an item, closes, and gives focus back', async () => {
  const page = await mounted();
  const area = page.get('.area');
  area.focus();
  rightClick(area);
  await page.waitFor(() => expect(find('.menu')).not.toBeNull());
  await page.waitFor(() => expect(document.activeElement).toBe(find('.menu')));
  press('ArrowDown', find('.menu')!);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.cut')));
  press('Enter');
  await page.waitFor(() => expect(state(page)[0]).toEqual(['cut']));
  await page.waitFor(() => expect(find('.menu')).toBeNull());
  expect(document.activeElement).toBe(area);
});

it('opens a submenu with the arrow keys', async () => {
  const page = await mounted();
  const area = page.get('.area');
  area.focus();
  rightClick(area);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.menu')));
  press('End', find('.menu')!);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.share')));
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(find('.email')));
  press('Escape');
  await page.waitFor(() => expect(find('.submenu')).toBeNull());
  expect(find('.menu')).not.toBeNull();
});

it('opens under the focused element with the context menu key, at the first item', async () => {
  const page = await mounted();
  const area = page.get('.area');
  area.focus();
  area.getBoundingClientRect = () => new DOMRect(100, 20, 100, 30);
  press('ContextMenu', area);
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 0 });
  area.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.cut')));
  await page.waitFor(() => expect(find('.popover')!.style.left).toBe('100px'));
  expect(find('.popover')!.style.top).toBe('50px');
});

it('opens with Shift+F10 the same way', async () => {
  const page = await mounted();
  const area = page.get('.area');
  area.focus();
  press('F10', area, { shiftKey: true });
  area.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.cut')));
});

it('opens on a long press of a touch, and a short touch or a scroll opens nothing', async () => {
  const page = await mounted();
  const area = page.get('.area');
  pointer('pointerdown', area, { pointerType: 'touch', clientX: 30, clientY: 40 });
  pointer('pointerup', area, { pointerType: 'touch', clientX: 30, clientY: 40 });
  // A move of more than a few pixels is a scroll.
  pointer('pointerdown', area, { pointerType: 'touch', clientX: 30, clientY: 40 });
  pointer('pointermove', area, { pointerType: 'touch', clientX: 30, clientY: 80 });
  await new Promise((done) => setTimeout(done, 700));
  expect(find('.menu')).toBeNull();
  // A small move is not.
  pointer('pointerdown', area, { pointerType: 'touch', clientX: 30, clientY: 40 });
  pointer('pointermove', area, { pointerType: 'touch', clientX: 33, clientY: 42 });
  await page.waitFor(() => expect(find('.menu')).not.toBeNull());
  await page.waitFor(() => expect(find('.popover')!.style.left).toBe('30px'));
  expect(find('.popover')!.style.top).toBe('40px');
  // The release of the touch does not close it.
  pointer('pointerup', area, { pointerType: 'touch', clientX: 33, clientY: 42 });
  await new Promise((done) => setTimeout(done, 50));
  expect(find('.menu')).not.toBeNull();
});

it('opens the inner menu on the inner area, and the outer one elsewhere', async () => {
  const page = await mounted();
  rightClick(page.get('.inner'));
  await page.waitFor(() => expect(find('.inner-menu')).not.toBeNull());
  expect(find('.menu')).toBeNull();
});

it('keeps the menu of the browser away inside the menu, and closes on a right click outside', async () => {
  const page = await mounted();
  rightClick(page.get('.area'));
  await page.waitFor(() => expect(find('.menu')).not.toBeNull());
  const inside = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  find('.cut')!.dispatchEvent(inside);
  expect(inside.defaultPrevented).toBe(true);
  expect(find('.menu')).not.toBeNull();
  const outside = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  document.body.dispatchEvent(outside);
  expect(outside.defaultPrevented).toBe(true);
  await page.waitFor(() => expect(find('.menu')).toBeNull());
});

it('moves the menu to the point of a right click on the area while it is open', async () => {
  const page = await mounted();
  const area = page.get('.area');
  rightClick(area, 40, 60);
  await page.waitFor(() => expect(find('.menu')).not.toBeNull());
  await page.waitFor(() => expect(find('.popover')!.style.left).toBe('40px'));
  // The page is inert while the menu is open, so a browser sends the event to the page, and the
  // area is found under the point once the menu has left.
  const under = vi.spyOn(document, 'elementFromPoint').mockReturnValue(area);
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: 300,
    clientY: 200,
  });
  document.body.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  await page.waitFor(() => expect(find('.popover')?.style.left).toBe('300px'));
  expect(find('.popover')!.style.top).toBe('200px');
  under.mockRestore();
});

it('closes for a right click outside the area, and opens nothing', async () => {
  const page = await mounted();
  rightClick(page.get('.area'));
  await page.waitFor(() => expect(find('.menu')).not.toBeNull());
  const under = vi.spyOn(document, 'elementFromPoint').mockReturnValue(page.get('.before'));
  document.body.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }),
  );
  await page.waitFor(() => expect(find('.menu')).toBeNull());
  await new Promise((done) => setTimeout(done, 200));
  expect(find('.menu')).toBeNull();
  under.mockRestore();
});

it('closes when the page scrolls, and stays open when the menu scrolls', async () => {
  const page = await mounted();
  rightClick(page.get('.area'));
  await page.waitFor(() => expect(find('.menu')).not.toBeNull());
  find('.menu')!.dispatchEvent(new Event('scroll'));
  await new Promise((done) => setTimeout(done, 50));
  expect(find('.menu')).not.toBeNull();
  // An event for a scroll that ended before the menu opened moves nothing.
  document.dispatchEvent(new Event('scroll'));
  await new Promise((done) => setTimeout(done, 50));
  expect(find('.menu')).not.toBeNull();
  const scrollY = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(120);
  document.dispatchEvent(new Event('scroll'));
  await page.waitFor(() => expect(find('.menu')).toBeNull());
  scrollY.mockRestore();
});

it('warns once in development about a context menu with no name', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const page = await mounted();
  rightClick(page.get('.area'));
  await page.waitFor(() => expect(find('.menu')).not.toBeNull());
  expect(warn).not.toHaveBeenCalled();
  press('Escape', find('.menu')!);
  await page.waitFor(() => expect(find('.menu')).toBeNull());
  rightClick(page.get('.bare'));
  await page.waitFor(() => expect(find('.bare-menu')).not.toBeNull());
  expect(warn).toHaveBeenCalledTimes(1);
  expect(String(warn.mock.calls[0]![0])).toContain('aria-label');
  warn.mockRestore();
});

it('leaves a menu with a Button alone', async () => {
  const page = await mounted();
  const trigger = page.get('.plain-trigger');
  expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  trigger.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});

function chord(target: Element, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

it('opens the dialog with Mod+K, and Mod+K again closes it', async () => {
  const page = await mounted();
  page.get('.before').focus();
  const event = chord(document.body, { key: 'k', metaKey: true });
  expect(event.defaultPrevented).toBe(true);
  await page.waitFor(() => expect(find('.dialog')).not.toBeNull());
  expect(state(page)[1]).toBe(1);
  chord(document.activeElement ?? document.body, { key: 'k', ctrlKey: true });
  await page.waitFor(() => expect(find('.dialog')).toBeNull());
  // Focus goes back to where it was.
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.before')));
});

it('does nothing without the modifier, or with another one', async () => {
  await mounted();
  chord(document.body, { key: 'k' });
  chord(document.body, { key: 'k', altKey: true });
  chord(document.body, { key: 'j', metaKey: true });
  await new Promise((done) => setTimeout(done, 50));
  expect(find('.dialog')).toBeNull();
});

it('leaves the key to a text field', async () => {
  const page = await mounted();
  page.get('.field').focus();
  const event = chord(page.get('.field'), { key: 'k', metaKey: true });
  expect(event.defaultPrevented).toBe(false);
  await new Promise((done) => setTimeout(done, 50));
  expect(find('.dialog')).toBeNull();
});

it('leaves the key to a field that handles it', async () => {
  const page = await mounted();
  page.get('.own-field').focus();
  chord(page.get('.own-field'), { key: 'k', metaKey: true });
  await new Promise((done) => setTimeout(done, 50));
  expect(find('.dialog')).toBeNull();
  expect(state(page)[2]).toBe(1);
});

it('opens from a text field when shortcutInInput is set', async () => {
  const page = await mounted();
  page.get('.field').focus();
  chord(page.get('.field'), { key: 'j', altKey: true });
  await page.waitFor(() => expect(find('.alt-dialog')).not.toBeNull());
});

const options = {
  placement: 'bottom start',
  offset: 0,
  crossOffset: 0,
  shouldFlip: true,
  containerPadding: 8,
  direction: 'ltr',
} as const;

it('places an overlay at a point, and flips it above a point near the bottom', () => {
  const view = { width: 1000, height: 800 };
  const menu = { width: 200, height: 300 };
  const at = computePosition(pointAnchor(100, 50).getBoundingClientRect(), menu, view, options);
  expect([at.left, at.top, at.side]).toEqual([100, 50, 'bottom']);
  // Not enough room below: the menu ends at the point.
  const flipped = computePosition(
    pointAnchor(100, 700).getBoundingClientRect(),
    menu,
    view,
    options,
  );
  expect([flipped.left, flipped.top, flipped.side]).toEqual([100, 400, 'top']);
  // Near the right edge it stays inside the window.
  const pushed = computePosition(pointAnchor(950, 50).getBoundingClientRect(), menu, view, options);
  expect(pushed.left).toBe(792);
  // Right to left, the menu extends to the left of the point.
  const rtl = computePosition(pointAnchor(500, 50).getBoundingClientRect(), menu, view, {
    ...options,
    direction: 'rtl',
  });
  expect(rtl.left).toBe(300);
});
