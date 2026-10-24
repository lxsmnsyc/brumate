// The tests of the boxes follow the tests of Checkbox, CheckboxGroup, RadioGroup and Switch in
// React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Boxes from './fixtures/boxes.brm?brumate-server';
import { pointer, press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => unmount?.());

async function boxes() {
  const page = await mount(Boxes, {});
  unmount = page.unmount;
  return page;
}

const input = (page: { get(selector: string): Element }, selector: string) =>
  page.get(`${selector} input`) as HTMLInputElement;

it('renders a label around a native checkbox, which toggles its own state', async () => {
  const page = await boxes();
  const label = page.get('.own');
  const box = input(page, '.own');
  expect(label.tagName).toBe('LABEL');
  expect(box.type).toBe('checkbox');
  expect(box.name).toBe('news');
  expect(box.className).toContain('visually-hidden');
  box.click();
  await page.waitFor(() => expect(label.hasAttribute('data-selected')).toBe(true));
  expect(box.checked).toBe(true);
  box.click();
  await page.waitFor(() => expect(label.hasAttribute('data-selected')).toBe(false));
});

it('writes a bound value, and shows press, hover and focus on the label', async () => {
  const page = await boxes();
  const label = page.get('.terms');
  const box = input(page, '.terms');
  pointer('pointerenter', label);
  pointer('pointerdown', label);
  await page.waitFor(() => expect(label.hasAttribute('data-pressed')).toBe(true));
  expect(label.hasAttribute('data-hovered')).toBe(true);
  pointer('pointerup', label);
  box.click();
  await page.waitFor(() => expect(page.text('.values')).toMatch(/^true\|/));
  box.focus();
  await page.waitFor(() => expect(label.hasAttribute('data-focused')).toBe(true));
  press(' ', box);
  await page.waitFor(() => expect(label.hasAttribute('data-focus-visible')).toBe(true));
});

it('sets the indeterminate state of the box, which needs code', async () => {
  const page = await boxes();
  expect(page.get('.mixed').hasAttribute('data-indeterminate')).toBe(true);
  await page.waitFor(() => expect(input(page, '.mixed').indeterminate).toBe(true), 3000);
});

it('keeps the state of a read-only box', async () => {
  const page = await boxes();
  const box = input(page, '.locked');
  expect(box.getAttribute('aria-readonly')).toBe('true');
  box.click();
  await page.waitFor(() => expect(box.checked).toBe(true));
  expect(page.get('.locked').hasAttribute('data-selected')).toBe(true);
});

it('keeps the values of a CheckboxGroup, and names it with its label', async () => {
  const page = await boxes();
  const group = page.get('.toppings');
  expect(group.getAttribute('role')).toBe('group');
  expect(group.getAttribute('aria-labelledby')).toBe(
    page.get('.toppings label, .toppings > label').id,
  );
  expect(input(page, '.cheese').checked).toBe(true);
  expect(input(page, '.cheese').name).toBe('toppings');
  input(page, '.olives').click();
  await page.waitFor(() => expect(page.text('.values')).toContain('|cheese,olives|'));
  input(page, '.cheese').click();
  await page.waitFor(() => expect(page.text('.values')).toContain('|olives|'));
});

it('asks for a box of a required group on a submit, and shows the message', async () => {
  const page = await boxes();
  input(page, '.cheese').click();
  await page.waitFor(() => expect(input(page, '.olives').required).toBe(true));
  expect((page.get('.form') as HTMLFormElement).checkValidity()).toBe(false);
  await page.waitFor(() => expect(page.container.querySelector('.toppings-error')).not.toBeNull());
  expect(page.get('.toppings').hasAttribute('data-invalid')).toBe(true);
  input(page, '.olives').click();
  await page.waitFor(() => expect(page.container.querySelector('.toppings-error')).toBeNull());
  expect(input(page, '.cheese').required).toBe(false);
});

it('gives the radios of a RadioGroup one name, and writes the choice', async () => {
  const page = await boxes();
  const group = page.get('.sizes');
  expect(group.getAttribute('role')).toBe('radiogroup');
  expect(group.getAttribute('aria-orientation')).toBe('vertical');
  const small = input(page, '.small');
  const large = input(page, '.large');
  expect(small.type).toBe('radio');
  expect(small.name).toBe(large.name);
  expect(small.required).toBe(true);
  large.click();
  await page.waitFor(() => expect(page.text('.values')).toContain('|large|'));
  expect(page.get('.large').hasAttribute('data-selected')).toBe(true);
  small.click();
  await page.waitFor(() => expect(page.get('.small').hasAttribute('data-selected')).toBe(true));
  expect(page.get('.large').hasAttribute('data-selected')).toBe(false);
});

it('renders a Switch as a checkbox with the role of a switch', async () => {
  const page = await boxes();
  const toggle = input(page, '.dark');
  expect(toggle.getAttribute('role')).toBe('switch');
  toggle.click();
  await page.waitFor(() => expect(page.text('.values')).toMatch(/\|true$/));
  expect(page.get('.dark').hasAttribute('data-selected')).toBe(true);
});
