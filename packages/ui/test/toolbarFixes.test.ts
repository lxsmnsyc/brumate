// The tests of the fixes of Toolbar, Meter, ProgressBar and the toggle buttons.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import ToolbarFixes from './fixtures/toolbarFixes.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => unmount?.());

async function fixes() {
  const page = await mount(ToolbarFixes, {});
  unmount = page.unmount;
  return page;
}

function key(target: Element, name: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

it('keeps a toolbar in the order of Tab when the item that held it becomes disabled', async () => {
  const page = await fixes();
  const save = page.get('.save') as HTMLButtonElement;
  const undo = page.get('.undo') as HTMLElement;
  save.focus();
  await page.waitFor(() => expect(undo.getAttribute('tabindex')).toBe('-1'));
  pressWith(save);
  await page.waitFor(() => expect(save.disabled).toBe(true));
  await page.waitFor(() => expect(undo.getAttribute('tabindex')).toBe('0'));
  // The arrow keys skip the disabled item.
  undo.focus();
  press('ArrowLeft', undo);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(document.activeElement).toBe(undo);
});

it('prevents only the arrow keys of its orientation', async () => {
  const page = await fixes();
  expect(key(page.get('.undo'), 'ArrowDown').defaultPrevented).toBe(false);
  expect(key(page.get('.up'), 'ArrowDown').defaultPrevented).toBe(true);
  expect(key(page.get('.up'), 'ArrowRight').defaultPrevented).toBe(false);
});

it('makes a toolbar inside a toolbar a group', async () => {
  const page = await fixes();
  expect(page.get('.edit').getAttribute('role')).toBe('toolbar');
  expect(page.get('.marks').getAttribute('role')).toBe('group');
  expect(page.get('.marks').hasAttribute('aria-orientation')).toBe(false);
  expect(page.get('.inner').getAttribute('role')).toBe('group');
  expect(page.get('.inner').hasAttribute('aria-orientation')).toBe(false);
});

it('disables every button of a disabled group', async () => {
  const page = await fixes();
  expect((page.get('.forced') as HTMLButtonElement).disabled).toBe(true);
});

it('gives aria-valuenow the value inside the range, and names a Meter by aria-label', async () => {
  const page = await fixes();
  const full = page.get('.full');
  expect(full.getAttribute('aria-valuenow')).toBe('100');
  expect(full.getAttribute('aria-valuetext')).toBe('100%');
  // There is no Label, so nothing names the ID once the browser is idle.
  await page.waitFor(() => expect(full.hasAttribute('aria-labelledby')).toBe(false), 3000);
});

it('gives the content of an indeterminate ProgressBar no value', async () => {
  const page = await fixes();
  expect(page.text('.spinner-text')).toBe('none|undefined');
});

it('prevents Home and End of a toolbar on a button, and moves focus', async () => {
  const page = await fixes();
  for (const name of ['.undo', '.up']) {
    const button = page.get(name) as HTMLElement;
    button.focus();
    // The code of the toolbar loads after the page.
    await page.waitFor(() => expect(key(button, 'Home').defaultPrevented).toBe(true));
    expect(key(button, 'End').defaultPrevented).toBe(true);
  }
  const up = page.get('.up') as HTMLElement;
  up.focus();
  key(up, 'End');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.down')));
});

it('leaves Home and End to a text field of a toolbar', async () => {
  const page = await fixes();
  const before = page.get('.before') as HTMLElement;
  before.focus();
  await page.waitFor(() => expect(key(before, 'End').defaultPrevented).toBe(true));
  const field = page.get('.field') as HTMLElement;
  field.focus();
  expect(key(field, 'Home').defaultPrevented).toBe(false);
  expect(key(field, 'End').defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(field);
});

it('prevents Home and End of a toggle button group, in either orientation', async () => {
  const page = await fixes();
  for (const name of ['.bold', '.va']) {
    const button = page.get(name) as HTMLElement;
    button.focus();
    expect(key(button, 'Home').defaultPrevented).toBe(true);
    expect(key(button, 'End').defaultPrevented).toBe(true);
  }
  const a = page.get('.va') as HTMLElement;
  a.focus();
  key(a, 'End');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.vb')));
  const vb = page.get('.vb') as HTMLElement;
  expect(key(vb, 'ArrowRight').defaultPrevented).toBe(false);
});
