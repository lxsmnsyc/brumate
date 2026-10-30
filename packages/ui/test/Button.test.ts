// The tests of Button.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Buttons from './fixtures/buttons.brm?brumate-server';
import PendingSubmit from './fixtures/pendingSubmit.brm?brumate-server';
import ButtonContext from './fixtures/buttonContext.brm?brumate-server';
import { takeEvents } from './fixtures/log.ts';
import { pointer, press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
beforeEach(() => {
  takeEvents();
});
afterEach(() => {
  unmount?.();
});

async function buttons() {
  const page = await mount(Buttons, {});
  unmount = page.unmount;
  return page;
}

/** Waits until the pending guards of submit Buttons, which sit in the `bCancels` of their forms, number `count`. */
function guardsReady(count: number) {
  return vi.waitFor(() => {
    let found = 0;
    for (const form of document.forms) {
      found += (form as { bCancels?: Set<unknown> }).bCancels?.size ?? 0;
    }
    expect(found).toBeGreaterThanOrEqual(count);
  });
}

/** The events so far, without taking them. */
const seen = () => types(globalThis.partEvents ?? []);

const types = (events: { type: string; pointerType?: string }[]) =>
  events.map((event) => `${event.type}:${event.pointerType}`);

it('renders a native button with the type button and the attributes of the caller', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  expect(button.tagName).toBe('BUTTON');
  expect(button.getAttribute('type')).toBe('button');
  expect(button.hasAttribute('role')).toBe(false);
  expect(page.get('.submit').getAttribute('type')).toBe('submit');
});

it('fires press events in order for a mouse, and shows data-pressed while it is down', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  pointer('pointerdown', button);
  await page.waitFor(() => expect(seen()).toEqual(['pressstart:mouse']));
  expect(button.hasAttribute('data-pressed')).toBe(true);
  takeEvents();
  pointer('pointerup', button);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  // The click after the pointer does not press again.
  await page.waitFor(() =>
    expect(seen()).toEqual(['pressup:mouse', 'pressend:mouse', 'press:mouse']),
  );
  expect(button.hasAttribute('data-pressed')).toBe(false);
  expect(page.text('.presses')).toBe('1');
});

it('passes the kind of pointer, such as touch and pen', async () => {
  const page = await buttons();
  pressWith(page.get('.plain'), { pointerType: 'touch' });
  await page.waitFor(() =>
    expect(seen()).toEqual(['pressstart:touch', 'pressup:touch', 'pressend:touch', 'press:touch']),
  );
});

it('ends a press without pressing when the pointer leaves, and starts again when it comes back', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  pointer('pointerdown', button, { clientX: 0, clientY: 0 });
  pointer('pointermove', button, { clientX: 100, clientY: 100 });
  await page.waitFor(() => expect(seen()).toEqual(['pressstart:mouse', 'pressend:mouse']));
  expect(button.hasAttribute('data-pressed')).toBe(false);
  takeEvents();
  pointer('pointermove', button, { clientX: 0, clientY: 0 });
  await page.waitFor(() => expect(button.hasAttribute('data-pressed')).toBe(true));
  pointer('pointermove', button, { clientX: 100, clientY: 100 });
  // A pointerup outside presses nothing.
  pointer('pointerup', button, { clientX: 100, clientY: 100 });
  await page.waitFor(() => expect(seen()).toEqual(['pressstart:mouse', 'pressend:mouse']));
  expect(page.text('.presses')).toBe('0');
});

it('ends a press that the browser cancels, without pressing', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  pointer('pointerdown', button);
  pointer('pointercancel', button);
  await page.waitFor(() => expect(seen()).toEqual(['pressstart:mouse', 'pressend:mouse']));
  expect(page.text('.presses')).toBe('0');
});

it('presses with a right click never', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  pointer('pointerdown', button, { button: 2 });
  pointer('pointerup', button, { button: 2 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(takeEvents()).toEqual([]);
});

it('presses with Enter and Space, once each', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  button.focus();
  button.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
  );
  // The browser clicks a button on Enter, with a detail of 0.
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  button.dispatchEvent(
    new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true }),
  );
  await page.waitFor(() =>
    expect(seen()).toEqual([
      'pressstart:keyboard',
      'pressup:keyboard',
      'pressend:keyboard',
      'press:keyboard',
    ]),
  );
  expect(page.text('.presses')).toBe('1');
  takeEvents();
  press(' ', button);
  await page.waitFor(() => expect(seen().at(-1)).toBe('press:keyboard'));
  expect(page.text('.presses')).toBe('2');
});

it('prevents the default of Space before the code loads, so the page does not scroll', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  button.dispatchEvent(down);
  button.dispatchEvent(enter);
  expect(down.defaultPrevented).toBe(true);
  // Enter keeps its default, so a submit button sends its form.
  expect(enter.defaultPrevented).toBe(false);
});

it('ignores a held key that repeats', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, repeat: true }));
  button.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
  await page.waitFor(() => expect(page.text('.presses')).toBe('1'));
  expect(types(takeEvents()).filter((type) => type.startsWith('pressstart'))).toHaveLength(1);
});

it('presses once for Enter held down, though the browser clicks for each repeat', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  const key = (type: string, repeat = false) =>
    button.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', bubbles: true, repeat }));
  const click = () => button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  key('keydown');
  click();
  key('keydown', true);
  click();
  key('keydown', true);
  click();
  key('keyup');
  await page.waitFor(() => expect(page.text('.presses')).toBe('1'));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(page.text('.presses')).toBe('1');
});

it('keeps Space on a submit button, so the browser sends its form, and presses once', async () => {
  const page = await buttons();
  const button = page.get('.send');
  button.focus();
  const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  const up = new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true });
  button.dispatchEvent(down);
  button.dispatchEvent(up);
  expect(down.defaultPrevented).toBe(false);
  expect(up.defaultPrevented).toBe(false);
  // The browser clicks the button after the keyup, and the click sends the form.
  button.click();
  await page.waitFor(() => expect(page.text('.sent')).toBe('1'));
  expect(types(takeEvents()).filter((type) => type.startsWith('press:'))).toEqual([
    'press:keyboard',
  ]);
});

it('keeps the type of a pending submit button, which neither sends nor hovers', async () => {
  const page = await buttons();
  // The submit button outside a form has no guard.
  await guardsReady(2);
  const button = page.get('.sending');
  expect(button.getAttribute('type')).toBe('submit');
  button.click();
  pointer('pointerenter', button);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(page.text('.sent')).toBe('0');
  expect(button.hasAttribute('data-hovered')).toBe(false);
  expect(takeEvents()).toEqual([]);
});

it('presses on the click of a screen reader after a press that ended outside', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  pointer('pointerdown', button, { clientX: 0, clientY: 0 });
  pointer('pointermove', button, { clientX: 100, clientY: 100 });
  pointer('pointerup', button, { clientX: 100, clientY: 100 });
  // The element holds the capture, so the browser sends it the click.
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  await page.waitFor(() => expect(seen()).toEqual(['pressstart:mouse', 'pressend:mouse']));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(page.text('.presses')).toBe('0');
  takeEvents();
  button.click();
  await page.waitFor(() => expect(seen().at(-1)).toBe('press:virtual'));
});

it('ends a press by a key when focus leaves, and one by a pointer that loses its capture', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  button.focus();
  button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  await page.waitFor(() => expect(button.hasAttribute('data-pressed')).toBe(true));
  button.blur();
  await page.waitFor(() => expect(button.hasAttribute('data-pressed')).toBe(false));
  expect(seen()).toEqual(['pressstart:keyboard', 'pressend:keyboard']);
  takeEvents();
  // A new key press starts again.
  button.focus();
  press('Enter', button);
  await page.waitFor(() => expect(seen().at(-1)).toBe('press:keyboard'));
  takeEvents();
  pointer('pointerdown', button);
  pointer('lostpointercapture', button);
  await page.waitFor(() => expect(seen()).toEqual(['pressstart:mouse', 'pressend:mouse']));
  takeEvents();
  // A new pointer press starts again.
  pressWith(button);
  await page.waitFor(() => expect(seen().at(-1)).toBe('press:mouse'));
  expect(page.text('.presses')).toBe('2');
});

it('presses on a click with no pointer, such as from a screen reader, as virtual', async () => {
  const page = await buttons();
  page.get('.plain').click();
  await page.waitFor(() =>
    expect(seen()).toEqual([
      'pressstart:virtual',
      'pressup:virtual',
      'pressend:virtual',
      'press:virtual',
    ]),
  );
});

it('does nothing while disabled, with the disabled attribute of a button', async () => {
  const page = await buttons();
  const button = page.get('.disabled');
  expect(button.hasAttribute('disabled')).toBe(true);
  expect(button.hasAttribute('data-disabled')).toBe(true);
  pressWith(button);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(takeEvents()).toEqual([]);
});

it('stays focusable while pending, and presses nothing', async () => {
  const page = await buttons();
  const button = page.get('.pending');
  expect(button.hasAttribute('disabled')).toBe(false);
  expect(button.getAttribute('aria-disabled')).toBe('true');
  expect(button.hasAttribute('data-pending')).toBe(true);
  button.focus();
  expect(document.activeElement).toBe(button);
  pressWith(button);
  press('Enter', button);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(takeEvents()).toEqual([]);
});

it('renders the element of as with the role and the focus of a button', async () => {
  const page = await buttons();
  const link = page.get('.link');
  expect(link.tagName).toBe('A');
  expect(link.getAttribute('href')).toBe('#top');
  expect(link.getAttribute('role')).toBe('button');
  expect(link.getAttribute('tabindex')).toBe('0');
  expect(link.hasAttribute('type')).toBe(false);
  pressWith(link);
  await page.waitFor(() => expect(seen()).toEqual(['press:mouse']));
  takeEvents();
  // Space presses it, as the role says, and follows the link.
  let followed = 0;
  link.addEventListener('click', () => followed++);
  link.focus();
  press(' ', link);
  await page.waitFor(() => expect(seen().at(-1)).toBe('press:keyboard'));
  expect(followed).toBe(1);
});

it('drops the address of a disabled button that renders as a link', async () => {
  const page = await buttons();
  const link = page.get('.hidden-link');
  expect(link.hasAttribute('href')).toBe(false);
  expect(link.hasAttribute('tabindex')).toBe(false);
  expect(link.getAttribute('aria-disabled')).toBe('true');
});

it('shows no focus ring for a shortcut with Control', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  button.focus();
  pointer('pointerdown', button);
  await page.waitFor(() => expect(button.hasAttribute('data-focused')).toBe(true));
  press('c', button, { ctrlKey: true });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(button.hasAttribute('data-focus-visible')).toBe(false);
  press('a', button);
  await page.waitFor(() => expect(button.hasAttribute('data-focus-visible')).toBe(true));
});

it('hovers with a mouse and not with touch', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  pointer('pointerenter', button, { pointerType: 'touch' });
  pointer('pointerenter', button);
  await page.waitFor(() => expect(button.hasAttribute('data-hovered')).toBe(true));
  pointer('pointerleave', button);
  await page.waitFor(() => expect(seen()).toEqual(['hoverstart:mouse', 'hoverend:mouse']));
  expect(button.hasAttribute('data-hovered')).toBe(false);
});

it('shows focus, and a focus ring after a key', async () => {
  const page = await buttons();
  const button = page.get('.plain');
  button.focus();
  await page.waitFor(() => expect(button.hasAttribute('data-focused')).toBe(true));
  press('Tab', button);
  await page.waitFor(() => expect(button.hasAttribute('data-focus-visible')).toBe(true));
  pointer('pointerdown', button);
  await page.waitFor(() => expect(button.hasAttribute('data-focus-visible')).toBe(false));
  button.blur();
  await page.waitFor(() => expect(button.hasAttribute('data-focused')).toBe(false));
});

it('reads its props from the slot of a context, and runs the handlers of both', async () => {
  const page = await mount(ButtonContext, {});
  unmount = page.unmount;
  const up = page.get('.up');
  const down = page.get('.down');
  expect(up.getAttribute('aria-label')).toBe('Increment');
  expect(down.hasAttribute('disabled')).toBe(true);
  pressWith(up);
  await page.waitFor(() => expect(page.text('.count')).toBe('1 1'));
  // The context gives a new value, and the button that reads it updates.
  await page.waitFor(() => expect(down.hasAttribute('disabled')).toBe(false));
  pressWith(down);
  await page.waitFor(() => expect(page.text('.count')).toBe('0 1'));
});

/** What the browser does for Enter in a field: it clicks the default button of the form. */
function implicitSubmit(form: Element) {
  const field = form.querySelector('input')!;
  field.focus();
  field.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
  );
  form.querySelector<HTMLElement>('button[type=submit]')!.click();
}

it('sends a form once while its submit button is pending, by a click or by Enter', async () => {
  const page = await mount(PendingSubmit, {});
  unmount = page.unmount;
  await guardsReady(3);
  const form = page.get('.one');
  const save = page.get('.save');
  save.click();
  await page.waitFor(() => expect(page.text('.sent')).toBe('1'));
  page.get('.toggle').click();
  await page.waitFor(() => expect(save.hasAttribute('data-pending')).toBe(true));
  expect(save.getAttribute('type')).toBe('submit');
  expect(save.getAttribute('aria-disabled')).toBe('true');
  save.click();
  implicitSubmit(form);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(page.text('.sent')).toBe('1');
  page.get('.toggle').click();
  await page.waitFor(() => expect(save.hasAttribute('data-pending')).toBe(false));
  implicitSubmit(form);
  await page.waitFor(() => expect(page.text('.sent')).toBe('2'));
});

it('sends a form with two submit buttons by the button that is not pending', async () => {
  const page = await mount(PendingSubmit, {});
  unmount = page.unmount;
  await guardsReady(3);
  page.get('.toggle').click();
  await page.waitFor(() => expect(page.get('.first').hasAttribute('data-pending')).toBe(true));
  // Enter clicks the default button, the first one, which is pending.
  implicitSubmit(page.get('.two'));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(page.text('.sent')).toBe('0');
  page.get('.second').click();
  await page.waitFor(() => expect(page.text('.sent')).toBe('1'));
});

it('leaves the submit listeners of the page alone while not pending, and removes its own', async () => {
  const page = await mount(PendingSubmit, {});
  await guardsReady(3);
  const form = page.get('.one') as HTMLFormElement & { bCancels: Set<unknown> };
  let others = 0;
  const count = () => others++;
  document.addEventListener('submit', count);
  page.get('.save').click();
  await page.waitFor(() => expect(page.text('.sent')).toBe('1'));
  // The button is not pending, so the listener of the page ran.
  expect(others).toBe(1);
  expect(form.bCancels.size).toBe(1);
  page.unmount();
  document.removeEventListener('submit', count);
  await page.waitFor(() => expect(form.bCancels.size).toBe(0));
});
