// The tests of Checkbox, CheckboxGroup, RadioGroup and Switch.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Boxes from './fixtures/boxes.brm?brumate-server';
import RequiredGroup from './fixtures/requiredGroup.brm?brumate-server';
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

it('prevents the click of a read-only box, so the browser never toggles it', async () => {
  const page = await boxes();
  expect(input(page, '.locked-small').checked).toBe(true);
  for (const selector of ['.locked', '.fixed', '.locked-large']) {
    const box = input(page, selector);
    const before = box.checked;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    box.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(box.checked).toBe(before);
  }
  expect(input(page, '.locked').getAttribute('aria-readonly')).toBe('true');
  expect(page.get('.locked').hasAttribute('data-selected')).toBe(true);
  expect(page.get('.locked-sizes').getAttribute('aria-readonly')).toBe('true');
  // happy-dom does not check the radio of before again after a prevented click, as a browser
  // does, so the Chrome steps check the radios.
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
  // The group keeps the state of every box, so the box that the user did not check is valid too.
  await page.waitFor(() => expect(input(page, '.cheese').hasAttribute('aria-invalid')).toBe(false));
  expect(page.get('.cheese').hasAttribute('data-invalid')).toBe(false);
});

it('renders the boxes of a required group optional, so a form posts without scripts', async () => {
  const { render } = await import('brumate/server');
  const { html } = await render(RequiredGroup, {});
  const inputs = html.match(/<input[^>]*>/g) ?? [];
  expect(inputs).toHaveLength(2);
  expect(inputs.filter((tag) => / required/.test(tag))).toEqual([]);
  // Once the code of the group runs, the browser asks for a box.
  const page = await mount(RequiredGroup, {});
  unmount = page.unmount;
  await page.waitFor(() => expect(input(page, '.bacon').required).toBe(true), 3000);
});

it('keeps a box indeterminate after a click, while the prop says so', async () => {
  const page = await boxes();
  const box = input(page, '.mixed');
  await page.waitFor(() => expect(box.indeterminate).toBe(true), 3000);
  box.click();
  await page.waitFor(() => expect(box.indeterminate).toBe(true));
  expect(box.checked).toBe(true);
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

it('ties the description and the error of a standalone Checkbox and Switch to the input', async () => {
  const page = await boxes();
  for (const [selector, text, error] of [
    ['.described', '.described-text', '.described-error'],
    ['.described-switch', '.switch-text', '.switch-error'],
  ]) {
    const box = input(page, selector);
    await page.waitFor(() => expect(page.get(text).id).not.toBe(''));
    expect(box.getAttribute('aria-describedby')).toBe(page.get(text).id);
    expect(box.hasAttribute('aria-invalid')).toBe(false);
    expect(document.querySelector(error)).toBeNull();
  }
  (page.get('.flag') as HTMLElement).click();
  for (const [selector, text, error] of [
    ['.described', '.described-text', '.described-error'],
    ['.described-switch', '.switch-text', '.switch-error'],
  ]) {
    const box = input(page, selector);
    await page.waitFor(() => expect(document.querySelector(error)).not.toBeNull());
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(box.getAttribute('aria-describedby')).toBe(`${page.get(text).id} ${page.get(error).id}`);
  }
});

// The name of the input by the rules of a native label: the text of the label without the
// input and the aria-hidden elements. The description joins the text of the elements it names.
function accessibleName(box: HTMLInputElement): string {
  const read = (node: Node): string => {
    if (node === box) {
      return '';
    }
    if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') {
      return '';
    }
    if (node.nodeType === 3) {
      return node.textContent ?? '';
    }
    return [...node.childNodes].map(read).join(' ');
  };
  return read(box.closest('label')!).replace(/\s+/g, ' ').trim();
}

function accessibleDescription(box: HTMLInputElement): string {
  const ids = (box.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
  return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
}

it('keeps the description and the error out of the name of a standalone Checkbox and Switch', async () => {
  const page = await boxes();
  const cases = [
    ['.described', 'Agree', 'Needed.', 'Needed. Please agree.'],
    ['.described-switch', 'Notify', 'Mails.', 'Mails. Cannot be off.'],
  ];
  for (const [selector, name, description] of cases) {
    const box = input(page, selector);
    await page.waitFor(() => expect(accessibleDescription(box)).toBe(description));
    expect(accessibleName(box)).toBe(name);
  }
  (page.get('.flag') as HTMLElement).click();
  for (const [selector, name, , both] of cases) {
    const box = input(page, selector);
    await page.waitFor(() => expect(accessibleDescription(box)).toBe(both));
    expect(accessibleName(box)).toBe(name);
  }
});
