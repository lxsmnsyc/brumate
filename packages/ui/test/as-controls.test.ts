// A component in `as` of the controls, overlays and status parts: the part renders it, forwards
// `ref` to its element, and keeps its keys, focus and ARIA.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import AsControls from './fixtures/asControls.brm?brumate-server';
import { press, pointer, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(async () => {
  unmount?.();
  // A portal renders outside the mounted container, which unmount removes.
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
  for (const element of document.querySelectorAll('[inert]')) {
    element.removeAttribute('inert');
  }
});

async function controls() {
  const page = await mount(AsControls, {});
  unmount = page.unmount;
  return page;
}

const find = (selector: string) => document.querySelector<HTMLElement>(selector);
const input = (page: { get: (selector: string) => HTMLElement }, selector: string) =>
  page.get(selector).querySelector<HTMLInputElement>('input')!;

it('renders each part as the component, with its own attributes', async () => {
  const page = await controls();
  for (const name of [
    'toggle',
    'toolbar',
    'group',
    'disclosure',
    'panel',
    'set',
    'radios',
    'boxes',
    'meter',
    'bar',
  ]) {
    const element = page.get(`.${name}`);
    expect([name, element.tagName]).toEqual([name, 'DIV']);
    expect([name, element.hasAttribute('data-as-target')]).toEqual([name, true]);
  }
});

it('forwards ref to the element of each part', async () => {
  const page = await controls();
  page.click('.add');
  await page.waitFor(() => expect(find('.toast')).not.toBeNull());
  page.click('.pop-trigger');
  await page.waitFor(() => expect(find('.dlg')).not.toBeNull());
  pointer('pointerenter', page.get('.tip-trigger'));
  await page.waitFor(() => expect(find('.tip')).not.toBeNull());
  page.click('.probe1');
  page.click('.probe2');
  page.click('.probe3');
  // One digit for each part, in groups of five: 1 when it gave back its element.
  await page.waitFor(() => expect(page.text('.found1')).toBe('11111'));
  await page.waitFor(() => expect(page.text('.found2')).toBe('11111'));
  await page.waitFor(() => expect(page.text('.found3')).toBe('11111'));
});

it('toggles a ToggleButton that is a component, with its role and state', async () => {
  const page = await controls();
  const toggle = page.get('.toggle');
  expect(toggle.getAttribute('role')).toBe('button');
  expect(toggle.getAttribute('tabindex')).toBe('0');
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  pressWith(toggle);
  await page.waitFor(() => expect(page.text('.pinned')).toBe('true'));
});

it('presses a ToggleButton that is a component with Enter', async () => {
  const page = await controls();
  const toggle = page.get('.toggle');
  toggle.focus();
  press('Enter', toggle);
  await page.waitFor(() => expect(page.text('.pinned')).toBe('true'));
});

// ToggleButton gives `as` on to a Button, and its attributes come from a spread. The project
// analysis follows a component that a page gives to a part, not one that a part gives to another.
it.fails('updates the ARIA of a ToggleButton that is a component', async () => {
  const page = await controls();
  const toggle = page.get('.toggle');
  pressWith(toggle);
  await page.waitFor(() => expect(page.text('.pinned')).toBe('true'));
  await page.waitFor(() => expect(toggle.getAttribute('aria-pressed')).toBe('true'), 500);
  expect(toggle.hasAttribute('data-selected')).toBe(true);
});

it('moves focus with the arrow keys in a Toolbar that is a component', async () => {
  const page = await controls();
  const toolbar = page.get('.toolbar');
  expect(toolbar.getAttribute('role')).toBe('toolbar');
  expect(toolbar.getAttribute('aria-orientation')).toBe('horizontal');
  const cut = page.get('.cut');
  cut.focus();
  await page.waitFor(() => expect(page.get('.copy').getAttribute('tabindex')).toBe('-1'));
  press('ArrowRight', cut);
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.copy')));
  press('End');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.paste')));
});

it('selects in a ToggleButtonGroup that is a component', async () => {
  const page = await controls();
  const group = page.get('.group');
  expect(group.getAttribute('role')).toBe('radiogroup');
  pressWith(page.get('.right'));
  await page.waitFor(() => expect(page.text('.choice')).toBe('right'));
  expect(page.get('.right').getAttribute('aria-checked')).toBe('true');
  page.get('.right').focus();
  press('ArrowLeft', page.get('.right'));
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.left')));
});

it('expands a Disclosure and its panel when both are components', async () => {
  const page = await controls();
  const trigger = page.get('.disclosure-trigger');
  const panel = page.get('.panel');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(panel.getAttribute('role')).toBe('group');
  expect(panel.hasAttribute('hidden')).toBe(true);
  pressWith(trigger);
  await page.waitFor(() => expect(page.text('.open')).toBe('true'));
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
  expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id);
});

it('updates the attributes of a Disclosure and its panel that are components', async () => {
  const page = await controls();
  pressWith(page.get('.disclosure-trigger'));
  await page.waitFor(() => expect(page.text('.open')).toBe('true'));
  await page.waitFor(
    () => expect(page.get('.disclosure').hasAttribute('data-expanded')).toBe(true),
    500,
  );
  expect(page.get('.panel').hasAttribute('hidden')).toBe(false);
});

it('keeps the state of a DisclosureGroup that is a component', async () => {
  const page = await controls();
  pressWith(page.get('.one-trigger'));
  await page.waitFor(() => expect(page.text('.keys')).toBe('one'));
  expect(page.get('.one-trigger').getAttribute('aria-expanded')).toBe('true');
  pressWith(page.get('.one-trigger'));
  await page.waitFor(() => expect(page.text('.keys')).toBe(''));
});

it('picks a radio of a RadioGroup that is a component', async () => {
  const page = await controls();
  const group = page.get('.radios');
  expect(group.getAttribute('role')).toBe('radiogroup');
  expect(group.getAttribute('aria-labelledby')).toBe(group.querySelector('label')!.id);
  input(page, '.large').click();
  await page.waitFor(() => expect(page.text('.size')).toBe('large'));
  expect(input(page, '.large').checked).toBe(true);
});

it('checks the boxes of a CheckboxGroup that is a component', async () => {
  const page = await controls();
  const group = page.get('.boxes');
  expect(group.getAttribute('role')).toBe('group');
  expect(group.getAttribute('aria-labelledby')).toBe(group.querySelector('label')!.id);
  input(page, '.ham').click();
  await page.waitFor(() => expect(page.text('.toppings')).toBe('ham'));
  input(page, '.cheese').click();
  await page.waitFor(() => expect(page.text('.toppings')).toBe('ham,cheese'));
});

it('gives a Meter and a ProgressBar that are components their role and value', async () => {
  const page = await controls();
  const meter = page.get('.meter');
  expect(meter.getAttribute('role')).toBe('meter');
  expect(meter.getAttribute('aria-valuenow')).toBe('40');
  expect(meter.style.getPropertyValue('--percentage')).toBe('40%');
  expect(meter.getAttribute('aria-labelledby')).toBe(meter.querySelector('label')!.id);
  const bar = page.get('.bar');
  expect(bar.getAttribute('role')).toBe('progressbar');
  expect(bar.getAttribute('aria-valuenow')).toBe('3');
  expect(bar.getAttribute('aria-valuemax')).toBe('4');
  expect(bar.style.getPropertyValue('--percentage')).toBe('75%');
});

it('renders a ToastRegion that is a component, with its toast', async () => {
  const page = await controls();
  expect(find('.region')).toBeNull();
  page.click('.add');
  await page.waitFor(() => expect(find('.toast')).not.toBeNull());
  const region = find('.region')!;
  expect(region.hasAttribute('data-as-target')).toBe(true);
  expect(region.getAttribute('role')).toBe('region');
  expect(region.getAttribute('aria-label')).toBe('Notifications');
  const toast = find('.toast')!;
  expect(toast.getAttribute('role')).toBe('alertdialog');
  expect(toast.hasAttribute('data-toast-key')).toBe(true);
  expect(toast.getAttribute('aria-labelledby')).toBe(find('.title')!.id);
  expect(find('.close')!.getAttribute('aria-label')).toBe('Close');
});

// The toasts are the children of the component, which do not update when a toast leaves.
it.fails('removes a toast from a ToastRegion that is a component', async () => {
  const page = await controls();
  page.click('.add');
  await page.waitFor(() => expect(find('.toast')).not.toBeNull());
  const close = find('.close')!;
  close.focus();
  pressWith(close);
  await page.waitFor(() => expect(find('.toast')).toBeNull(), 500);
});

// The template of the toast reads the component as a value, and its part does not import it.
it.fails('renders a Toast that is a component', async () => {
  const page = await controls();
  page.click('.add-as');
  await page.waitFor(() => expect(find('.toast-as')).not.toBeNull(), 500);
  const toast = find('.toast-as')!;
  expect(toast.hasAttribute('data-as-target')).toBe(true);
  expect(toast.getAttribute('role')).toBe('alertdialog');
  expect(toast.getAttribute('aria-labelledby')).toBe(find('.title-as')!.id);
  find('.close-as')!.focus();
  pressWith(find('.close-as')!);
  await page.waitFor(() => expect(find('.toast-as')).toBeNull());
});

it('opens a Popover and a Dialog that are components, and closes them with Escape', async () => {
  const page = await controls();
  const trigger = page.get('.pop-trigger');
  expect(find('.pop')).toBeNull();
  pressWith(trigger);
  await page.waitFor(() => expect(find('.dlg')).not.toBeNull());
  const popover = find('.pop')!;
  const dialog = find('.dlg')!;
  expect(popover.hasAttribute('data-as-target')).toBe(true);
  expect(popover.style.position).toBe('fixed');
  expect(dialog.hasAttribute('data-as-target')).toBe(true);
  expect(dialog.getAttribute('role')).toBe('dialog');
  expect(dialog.getAttribute('aria-label')).toBe('Settings');
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  await page.waitFor(() => expect(popover.contains(document.activeElement)).toBe(true));
  press('Escape', find('.dlg-close') ?? dialog);
  await page.waitFor(() => expect(find('.pop')).toBeNull());
});

it('shows a Tooltip that is a component, and describes its trigger', async () => {
  const page = await controls();
  const trigger = page.get('.tip-trigger');
  pointer('pointerenter', trigger);
  await page.waitFor(() => expect(find('.tip')).not.toBeNull());
  const tip = find('.tip')!;
  expect(tip.hasAttribute('data-as-target')).toBe(true);
  expect(tip.getAttribute('role')).toBe('tooltip');
  expect(tip.style.position).toBe('fixed');
  await page.waitFor(() => expect(trigger.getAttribute('aria-describedby')).toBe(tip.id));
  pointer('pointerleave', trigger);
  await page.waitFor(() => expect(find('.tip')).toBeNull());
});
