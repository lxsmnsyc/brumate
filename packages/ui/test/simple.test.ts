// The tests of the simple parts follow their tests in React Aria Components.
import { afterEach, beforeEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Simple from './fixtures/simple.brm?brumate-server';
import { takeEvents } from './fixtures/log.ts';
import { pointer, press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
beforeEach(() => takeEvents());
afterEach(() => unmount?.());

async function simple() {
  const page = await mount(Simple, {});
  unmount = page.unmount;
  return page;
}

it('renders a horizontal Separator as an <hr>, and a vertical one with its role', async () => {
  const page = await simple();
  const horizontal = page.get('.horizontal');
  expect(horizontal.tagName).toBe('HR');
  expect(horizontal.hasAttribute('role')).toBe(false);
  expect(horizontal.getAttribute('data-orientation')).toBe('horizontal');
  const vertical = page.get('.vertical');
  expect(vertical.tagName).toBe('DIV');
  expect(vertical.getAttribute('role')).toBe('separator');
  expect(vertical.getAttribute('aria-orientation')).toBe('vertical');
});

it('renders a Heading of the level of its context, or of its own', async () => {
  const page = await simple();
  expect(page.get('.from-context').tagName).toBe('H2');
  expect(page.get('.own').tagName).toBe('H4');
});

it('gives a Label and a Text the attributes of their contexts', async () => {
  const page = await simple();
  const label = page.get('.label');
  expect(label.tagName).toBe('LABEL');
  expect(label.id).toBe('name-label');
  expect(label.getAttribute('for')).toBe('name');
  const description = page.get('.description');
  expect(description.id).toBe('name-description');
  expect(description.hasAttribute('slot')).toBe(false);
});

it('shows focus within a Group, and its focus ring', async () => {
  const page = await simple();
  const group = page.get('.group');
  expect(group.getAttribute('role')).toBe('group');
  (page.get('.amount') as HTMLInputElement).focus();
  await page.waitFor(() => expect(group.hasAttribute('data-focus-within')).toBe(true));
  // Focus moves inside the group, and stays within it.
  (page.get('.more') as HTMLButtonElement).focus();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(group.hasAttribute('data-focus-within')).toBe(true);
  (page.get('.more') as HTMLButtonElement).blur();
  await page.waitFor(() => expect(group.hasAttribute('data-focus-within')).toBe(false));
  pointer('pointerenter', group);
  await page.waitFor(() => expect(group.hasAttribute('data-hovered')).toBe(true));
  const off = page.get('.disabled-group');
  expect(off.getAttribute('aria-disabled')).toBe('true');
  expect(off.hasAttribute('data-invalid')).toBe(true);
});

it('renders a Link as an <a>, which presses with a key and a pointer', async () => {
  const page = await simple();
  const link = page.get('.to');
  expect(link.tagName).toBe('A');
  expect(link.getAttribute('href')).toBe('#top');
  expect(link.hasAttribute('role')).toBe(false);
  link.focus();
  press('Enter', link);
  await page.waitFor(() =>
    expect(globalThis.partEvents).toEqual([{ type: 'press', pointerType: 'keyboard' }]),
  );
  takeEvents();
  pressWith(link);
  await page.waitFor(() =>
    expect(globalThis.partEvents).toEqual([{ type: 'press', pointerType: 'mouse' }]),
  );
});

it('leaves Space to the browser on a Link, which presses only with Enter', async () => {
  const page = await simple();
  for (const name of ['.to', '.span']) {
    const link = page.get(name);
    link.focus();
    const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    link.dispatchEvent(down);
    link.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
    // The page scrolls, as for any link.
    expect(down.defaultPrevented).toBe(false);
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(takeEvents()).toEqual([]);
  press('Enter', page.get('.span'));
  await page.waitFor(() =>
    expect(globalThis.partEvents).toEqual([{ type: 'press', pointerType: 'keyboard' }]),
  );
});

it('marks the current Link, and leaves out the address of a disabled one', async () => {
  const page = await simple();
  const current = page.get('.current');
  expect(current.getAttribute('aria-current')).toBe('page');
  expect(current.hasAttribute('data-current')).toBe(true);
  const off = page.get('.off');
  expect(off.tagName).toBe('SPAN');
  expect(off.hasAttribute('href')).toBe(false);
  expect(off.getAttribute('role')).toBe('link');
  expect(off.getAttribute('aria-disabled')).toBe('true');
  // It stays in the order of Tab, so a keyboard user hears that it is disabled.
  expect(off.getAttribute('tabindex')).toBe('0');
  // A link without an address is an element with the role and the focus of a link.
  const span = page.get('.span');
  expect(span.getAttribute('role')).toBe('link');
  expect(span.getAttribute('tabindex')).toBe('0');
});

it('toggles a ToggleButton, its own state or the bound one of its caller', async () => {
  const page = await simple();
  const own = page.get('.own-toggle');
  expect(own.getAttribute('aria-pressed')).toBe('false');
  pressWith(own);
  await page.waitFor(() => expect(own.getAttribute('aria-pressed')).toBe('true'));
  expect(own.hasAttribute('data-selected')).toBe(true);
  await page.waitFor(() => expect(globalThis.partEvents).toEqual([{ type: 'own', value: true }]));
  const bold = page.get('.bold');
  bold.focus();
  press(' ', bold);
  await page.waitFor(() => expect(page.text('.bold-value')).toBe('true'));
  expect(bold.getAttribute('aria-pressed')).toBe('true');
});
