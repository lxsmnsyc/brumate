// The tests of PopoverGroup and Alert.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Groups from './fixtures/popover-groups.brm?brumate-server';
import { press, pressWith } from './interact.ts';
import { leaveByTab } from '../src/overlay.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
});

async function groups() {
  const page = await mount(Groups, {});
  unmount = page.unmount;
  return page;
}

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

async function openA(page: Awaited<ReturnType<typeof groups>>) {
  pressWith(page.get('.a-trigger'));
  await page.waitFor(() => expect(find('.a-popover')).not.toBeNull());
  await page.waitFor(() => expect(document.activeElement).toBe(find('.a-dialog')));
}

it('keeps a popover open when focus goes to the trigger of another one of the group', async () => {
  const page = await groups();
  await openA(page);
  page.get('.b-trigger').focus();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(find('.a-popover')).not.toBeNull();
  // Focus in the group element, such as on a link, keeps it too, as in Headless UI.
  page.get('.group-link').focus();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(find('.a-popover')).not.toBeNull();
});

it('closes the other popovers of the group when one opens', async () => {
  const page = await groups();
  await openA(page);
  pressWith(page.get('.b-trigger'));
  await page.waitFor(() => expect(find('.b-popover')).not.toBeNull());
  await page.waitFor(() => expect(find('.a-popover')).toBeNull());
  expect(find('.b-popover')).not.toBeNull();
});

it('closes a popover of the group for focus that goes outside the group', async () => {
  const page = await groups();
  await openA(page);
  page.get('.elsewhere').focus();
  await page.waitFor(() => expect(find('.a-popover')).toBeNull());
});

it('closes a popover for the trigger of another one when there is no group', async () => {
  const page = await groups();
  pressWith(page.get('.solo-trigger'));
  await page.waitFor(() => expect(find('.solo-popover')).not.toBeNull());
  page.get('.a-trigger').focus();
  await page.waitFor(() => expect(find('.solo-popover')).toBeNull());
});

it('moves Tab from the end of a panel to the next element after its trigger, and Shift+Tab from its start to the trigger', async () => {
  const page = await groups();
  await openA(page);
  find('.a-first')!.focus();
  press('Tab', find('.a-first'), { shiftKey: true });
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.a-trigger')));
  find('.a-last')!.focus();
  press('Tab', find('.a-last'));
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.b-trigger')));
  // The first stays open while focus is on the trigger of the next.
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(find('.a-popover')).not.toBeNull();
  // The middle of a panel is left to the browser.
  find('.a-first')!.focus();
  const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  find('.a-first')!.dispatchEvent(event);
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(event.defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(find('.a-first'));
});

it('renders an Alert with role="alert", on the element that `as` names', async () => {
  const page = await groups();
  const plain = page.get('.plain');
  expect(plain.tagName).toBe('P');
  expect(plain.getAttribute('role')).toBe('alert');
  expect(plain.getAttribute('aria-live')).toBe('assertive');
});

it('renders an Alert only while there is a message', async () => {
  const page = await groups();
  expect(find('.alert')).toBeNull();
  pressWith(page.get('.say'));
  await page.waitFor(() => expect(find('.alert')?.getAttribute('role')).toBe('alert'));
  expect(find('.alert')!.textContent).toBe('Saved');
  pressWith(page.get('.clear'));
  await page.waitFor(() => expect(find('.alert')).toBeNull());
});

it('renders a new Alert element for the same message under a new #key', async () => {
  const page = await groups();
  pressWith(page.get('.say'));
  await page.waitFor(() => expect(find('.alert')).not.toBeNull());
  const first = find('.alert');
  pressWith(page.get('.say'));
  await page.waitFor(() => expect(find('.alert')).not.toBe(first));
  expect(find('.alert')!.textContent).toBe('Saved');
});

it('renders the group as a div with a marker, and passes its props', async () => {
  const page = await groups();
  const nav = page.get('.nav');
  expect(nav.tagName).toBe('DIV');
  expect(nav.getAttribute('aria-label')).toBe('Menus');
  expect(nav.hasAttribute('data-popover-group')).toBe(true);
});

function tabKey(shiftKey = false) {
  return new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
}

it('leaveByTab: an empty panel sends Tab to the next element after the trigger', () => {
  document.body.innerHTML =
    '<button id="t">T</button><button id="n">N</button><div id="p" tabindex="-1"></div>';
  const panel = document.getElementById('p')!;
  panel.focus();
  const event = tabKey();
  expect(leaveByTab(panel, document.getElementById('t'), event)).toBe(true);
  expect(event.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(document.getElementById('n'));
  panel.focus();
  expect(leaveByTab(panel, document.getElementById('t'), tabKey(true))).toBe(true);
  expect(document.activeElement).toBe(document.getElementById('t'));
  document.body.innerHTML = '';
});

it('leaveByTab: leaves Tab alone when the trigger is the last element of the page', () => {
  document.body.innerHTML =
    '<button id="x">X</button><button id="t">T</button><div id="p" data-layer tabindex="-1"><button id="in">In</button></div>';
  const panel = document.getElementById('p')!;
  document.getElementById('in')!.focus();
  const event = tabKey();
  expect(leaveByTab(panel, document.getElementById('t'), event)).toBe(false);
  expect(event.defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(document.getElementById('in'));
  document.body.innerHTML = '';
});
