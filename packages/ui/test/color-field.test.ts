// The tests of ColorField follow the tests of ColorField in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import ColorFields from './fixtures/colorfields.brm?brumate-server';
import { press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function colorfields() {
  const page = await mount(ColorFields, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof colorfields>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as (string | null)[];
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function blur(input: HTMLInputElement) {
  input.dispatchEvent(new FocusEvent('blur'));
}

it('shows the hex of the color, and is labelled, described and named', async () => {
  const page = await colorfields();
  const input = page.get('.hex-input') as HTMLInputElement;
  expect(input.value).toBe('#E2445A');
  expect(page.get('.label').getAttribute('for')).toBe(input.id);
  expect(input.getAttribute('aria-describedby')).toContain(page.get('.description').id);
  expect(page.get('.hex').getAttribute('data-channel')).toBe('hex');
  expect((page.get('.hex input[type=hidden]') as HTMLInputElement).value).toBe('#E2445A');
  expect((page.get('.empty-input') as HTMLInputElement).value).toBe('');
});

it('commits typed hex on blur and Enter, in the format of the value', async () => {
  const page = await colorfields();
  const input = page.get('.hex-input') as HTMLInputElement;
  input.focus();
  type(input, '#336699');
  blur(input);
  await page.waitFor(() => expect(state(page)[0]).toBe('#336699'));
  expect(input.value).toBe('#336699');
  type(input, 'abc');
  press('Enter', input);
  await page.waitFor(() => expect(input.value).toBe('#AABBCC'));
  expect(state(page)[0]).toBe('#AABBCC');
  // Text that cannot become hex does not stay.
  type(input, '12zz');
  await page.waitFor(() => expect(input.value).toBe('#AABBCC'));
});

it('reverts invalid text, and clears the value when the field is empty', async () => {
  const page = await colorfields();
  const input = page.get('.hex-input') as HTMLInputElement;
  input.focus();
  type(input, '#12');
  blur(input);
  await page.waitFor(() => expect(input.value).toBe('#E2445A'));
  expect(state(page)[0]).toBe('#e2445a');
  type(input, '');
  blur(input);
  await page.waitFor(() => expect(state(page)[0]).toBe(null));
  expect(input.value).toBe('');
});

it('steps the hex number by 1, and by 16 with the page keys', async () => {
  const page = await colorfields();
  const input = page.get('.hex-input') as HTMLInputElement;
  input.focus();
  press('ArrowUp', input);
  await page.waitFor(() => expect(input.value).toBe('#E2445B'));
  press('ArrowDown', input);
  press('ArrowDown', input);
  await page.waitFor(() => expect(input.value).toBe('#E24459'));
  press('PageUp', input);
  await page.waitFor(() => expect(input.value).toBe('#E24469'));
  press('PageDown', input);
  await page.waitFor(() => expect(input.value).toBe('#E24459'));
  expect(state(page)[0]).toBe('#E24459');
  press('Home', input);
  await page.waitFor(() => expect(input.value).toBe('#000000'));
  press('End', input);
  await page.waitFor(() => expect(input.value).toBe('#FFFFFF'));
});

it('starts a step from black or white when the field is empty', async () => {
  const page = await colorfields();
  const input = page.get('.empty-input') as HTMLInputElement;
  input.focus();
  press('ArrowUp', input);
  await page.waitFor(() => expect(input.value).toBe('#000000'));
  expect(state(page)[2]).toBe('#000000');
  type(input, '');
  blur(input);
  await page.waitFor(() => expect(state(page)[2]).toBe(null));
  press('ArrowDown', input);
  await page.waitFor(() => expect(input.value).toBe('#FFFFFF'));
});

it('edits one channel as a number, in the format and the step of the channel', async () => {
  const page = await colorfields();
  const input = page.get('.hue-input') as HTMLInputElement;
  expect(page.get('.hue').getAttribute('data-channel')).toBe('hue');
  expect(input.value).toBe('120°');
  expect(input.getAttribute('aria-roledescription')).toBe('Number field');
  input.focus();
  press('ArrowUp', input);
  await page.waitFor(() => expect(input.value).toBe('121°'));
  expect(state(page)[1]).toBe('hsl(121, 50%, 50%)');
  press('PageUp', input);
  await page.waitFor(() => expect(input.value).toBe('136°'));
  type(input, '400');
  blur(input);
  await page.waitFor(() => expect(input.value).toBe('360°'));
  expect(state(page)[1]).toBe('hsl(360, 50%, 50%)');
  press('Home', input);
  await page.waitFor(() => expect(input.value).toBe('0°'));
  expect((page.get('.hue input[type=hidden]') as HTMLInputElement).value).toBe('0');
});

it('shows alpha as a percent, and names a channel field with no label', async () => {
  const page = await colorfields();
  const input = page.get('.alpha-input') as HTMLInputElement;
  expect(input.value).toBe('50%');
  await page.waitFor(() => expect(input.getAttribute('aria-label')).toBe('Alpha'));
  input.focus();
  press('ArrowUp', input);
  await page.waitFor(() => expect(input.value).toBe('51%'));
  type(input, '80');
  press('Enter', input);
  await page.waitFor(() => expect(input.value).toBe('80%'));
});

it('shows the states, and keeps a field that cannot change', async () => {
  const page = await colorfields();
  expect(page.get('.req').getAttribute('data-required')).toBe('true');
  expect((page.get('.req-input') as HTMLInputElement).required).toBe(true);
  expect(page.get('.locked').getAttribute('data-readonly')).toBe('true');
  expect(page.get('.off').getAttribute('data-disabled')).toBe('true');
  expect((page.get('.off-input') as HTMLInputElement).disabled).toBe(true);
  const locked = page.get('.locked-input') as HTMLInputElement;
  locked.focus();
  const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
  locked.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  await new Promise((done) => setTimeout(done, 50));
  expect(locked.value).toBe('#445566');
});

it('sends what was typed, and a reset gives back the first value', async () => {
  const page = await colorfields();
  const input = page.get('.req-input') as HTMLInputElement;
  const hidden = page.get('.req input[type=hidden]') as HTMLInputElement;
  expect(hidden.value).toBe('#112233');
  input.focus();
  type(input, '#ABCDEF');
  await page.waitFor(() => expect(hidden.value).toBe('#ABCDEF'));
  blur(input);
  (page.get('.form') as HTMLFormElement).reset();
  await page.waitFor(() => expect(input.value).toBe('#112233'));
  expect(hidden.value).toBe('#112233');
});

it('shows a value that the caller sets', async () => {
  const page = await colorfields();
  const input = page.get('.hex-input') as HTMLInputElement;
  (page.get('.shift') as HTMLButtonElement).click();
  await page.waitFor(() => expect(input.value).toBe('#336699'));
});
