// The tests of TokenField follow the tests of TokenField in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import TokenFields from './fixtures/token-fields.brm?brumate-server';
import { pressWith } from './interact.ts';
import { EDGE, normalize, readSegments, segmentsText, tokenize } from '../src/token-field.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function fields() {
  const page = await mount(TokenFields, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof fields>>;

function state(page: Page) {
  return JSON.parse(page.text('.state'));
}

it('makes the words that match the pattern into tokens once a space follows them', () => {
  expect(tokenize([{ type: 'text', text: 'Hi @ann and #tag here' }], '[#@]\\S+')).toEqual([
    { type: 'text', text: 'Hi ' },
    { type: 'token', text: '@ann' },
    { type: 'text', text: ' and ' },
    { type: 'token', text: '#tag' },
    { type: 'text', text: ' here' },
  ]);
  // A word that the user still types stays text.
  expect(tokenize([{ type: 'text', text: 'Hi @an' }], '[#@]\\S+')).toEqual([
    { type: 'text', text: 'Hi @an' },
  ]);
  expect(
    normalize([
      { type: 'text', text: 'a' },
      { type: 'text', text: '' },
      { type: 'text', text: 'b' },
    ]),
  ).toEqual([{ type: 'text', text: 'ab' }]);
  expect(
    segmentsText([
      { type: 'text', text: 'Hi ' },
      { type: 'token', text: '@ann' },
    ]),
  ).toBe('Hi @ann');
});

it('reads the value from the nodes of the box', () => {
  const box = document.createElement('div');
  box.innerHTML = `Hi ${EDGE}<span data-token="@ann" contenteditable="false"><span>@ann</span></span>${EDGE} there<br>bye`;
  expect(readSegments(box)).toEqual([
    { type: 'text', text: 'Hi ' },
    { type: 'token', text: '@ann' },
    { type: 'text', text: ' there\nbye' },
  ]);
});

it('renders the value with its tokens, named by its label and description', async () => {
  const page = await fields();
  const input = page.get('.input');
  expect(input.getAttribute('contenteditable')).toBe('true');
  expect(input.getAttribute('role')).toBe('textbox');
  expect(input.getAttribute('aria-labelledby')).toBe(page.get('.label').id);
  await page.waitFor(() =>
    expect(input.getAttribute('aria-describedby')).toBe(page.get('.description').id),
  );
  const token = input.querySelector('[data-token]')!;
  expect(token.getAttribute('contenteditable')).toBe('false');
  expect(token.querySelector('.mention')!.textContent).toBe('@ann');
  expect((page.get('.form input[name=message]') as HTMLInputElement).value).toBe('Hi @ann there');
  const empty = page.get('.empty-input');
  expect(empty.getAttribute('contenteditable')).toBe('false');
  expect(empty.getAttribute('aria-readonly')).toBe('true');
  expect(empty.hasAttribute('data-empty')).toBe(true);
  expect(empty.getAttribute('data-placeholder')).toBe('Nothing yet');
});

it('reads what the user typed, and makes a token of a word that matches', async () => {
  const page = await fields();
  const input = page.get('.input');
  // The user types at the end of the box.
  input.append(document.createTextNode(' #news '));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await page.waitFor(() =>
    expect(state(page)).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'token', text: '@ann' },
      { type: 'text', text: ' there ' },
      { type: 'token', text: '#news' },
      { type: 'text', text: ' ' },
    ]),
  );
  // The box is written again with the new token, from its template.
  await page.waitFor(() => expect(input.querySelectorAll('[data-token] .mention')).toHaveLength(2));
  expect((page.get('.form input[name=message]') as HTMLInputElement).value).toBe(
    'Hi @ann there #news ',
  );
});

it('writes the box when the value changes from outside', async () => {
  const page = await fields();
  pressWith(page.get('.reset'));
  await page.waitFor(() =>
    expect(page.get('.input').querySelector('[data-token]')!.getAttribute('data-token')).toBe(
      '#tag',
    ),
  );
  expect(page.get('.input').querySelectorAll('[data-token]')).toHaveLength(1);
  expect(page.get('.input').textContent!.replaceAll(EDGE, '')).toBe('#tag');
});

it('keeps the text of a composition until it ends', async () => {
  const page = await fields();
  const input = page.get('.input');
  // The first event loads the code, so the composition starts after it.
  input.dispatchEvent(new Event('focus'));
  await new Promise((resolve) => setTimeout(resolve, 50));
  input.dispatchEvent(new Event('compositionstart', { bubbles: true }));
  input.append(document.createTextNode(' か'));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  input.dispatchEvent(new Event('compositionend', { bubbles: true }));
  await page.waitFor(() =>
    expect(state(page)).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'token', text: '@ann' },
      { type: 'text', text: ' there か' },
    ]),
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(input.textContent!.replaceAll(EDGE, '')).toBe('Hi @ann there か');
});

it('keeps the text of a composition whose end comes before its input', async () => {
  const page = await fields();
  const input = page.get('.input');
  input.dispatchEvent(new Event('focus'));
  await new Promise((resolve) => setTimeout(resolve, 50));
  // Firefox ends the composition, then sends the input of its text.
  input.dispatchEvent(new Event('compositionstart', { bubbles: true }));
  input.append(document.createTextNode(' か'));
  input.dispatchEvent(new Event('compositionend', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await page.waitFor(() =>
    expect(state(page)).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'token', text: '@ann' },
      { type: 'text', text: ' there か' },
    ]),
  );
});

it('reads a line break that ends the box, or a line, as no text', () => {
  const box = document.createElement('div');
  box.innerHTML = '<br>';
  expect(readSegments(box)).toEqual([]);
  box.innerHTML = 'a<br>';
  expect(readSegments(box)).toEqual([{ type: 'text', text: 'a' }]);
  box.innerHTML = 'a<br>b';
  expect(readSegments(box)).toEqual([{ type: 'text', text: 'a\nb' }]);
});

it('reads lines in divs as a browser serializes them', () => {
  const box = document.createElement('div');
  box.innerHTML = 'a<div><br></div><div>b</div>';
  expect(readSegments(box)).toEqual([{ type: 'text', text: 'a\n\nb' }]);
  box.innerHTML = 'a<div>b</div>';
  expect(readSegments(box)).toEqual([{ type: 'text', text: 'a\nb' }]);
  box.innerHTML = 'a<div><br></div>';
  expect(readSegments(box)).toEqual([{ type: 'text', text: 'a\n' }]);
});

it('empties the box so the placeholder comes back', async () => {
  const page = await fields();
  const lines = page.get('.lines-input');
  // The browser leaves a line break in a box that the user emptied.
  lines.replaceChildren(document.createElement('br'));
  lines.dispatchEvent(new Event('input', { bubbles: true }));
  await page.waitFor(() => expect(page.text('.lines-state')).toBe('[]'));
  await page.waitFor(() => expect(lines.hasAttribute('data-empty')).toBe(true));
});

it('shows the new line that ends the value', async () => {
  const page = await fields();
  const lines = page.get('.lines-input');
  pressWith(page.get('.enter-lines'));
  await page.waitFor(() => expect(lines.lastChild?.nodeName).toBe('BR'));
  // The line break shows the line, and is no text.
  expect(readSegments(lines)).toEqual([{ type: 'text', text: 'a\n' }]);
  expect(JSON.parse(page.text('.lines-state'))).toEqual([{ type: 'text', text: 'a\n' }]);
});

it('does not make a token of an empty match', () => {
  expect(tokenize([{ type: 'text', text: 'a  b ' }], 'x*')).toEqual([
    { type: 'text', text: 'a  b ' },
  ]);
  expect(tokenize([{ type: 'text', text: 'xx  y ' }], 'x*')).toEqual([
    { type: 'token', text: 'xx' },
    { type: 'text', text: '  y ' },
  ]);
});

it('does not name a combobox that has no popup', async () => {
  const page = await fields();
  expect(page.get('.input').getAttribute('role')).toBe('textbox');
  // A field without a popup is no combobox, whatever role it is given.
  expect(page.get('.odd-input').getAttribute('role')).toBe('textbox');
  expect(page.get('.lines-input').getAttribute('aria-multiline')).toBe('true');
});

it('follows isDisabled and isReadOnly', async () => {
  const page = await fields();
  const box = page.get('.toggled-input');
  expect(box.getAttribute('contenteditable')).toBe('true');
  expect(box.querySelector('[data-token-part]')!.hasAttribute('data-disabled')).toBe(false);
  pressWith(page.get('.lock'));
  await page.waitFor(() => expect(box.getAttribute('contenteditable')).toBe('false'));
  pressWith(page.get('.disable'));
  await page.waitFor(() =>
    expect(box.querySelector('[data-token-part]')!.hasAttribute('data-disabled')).toBe(true),
  );
  expect(box.hasAttribute('tabindex')).toBe(false);
});

it('keeps the text typed before the code loaded', async () => {
  const page = await fields();
  const input = page.get('.input');
  input.append(document.createTextNode(' soon'));
  // The first event loads the code, whose effect sees the box before any input handler runs.
  input.dispatchEvent(new Event('focus'));
  await page.waitFor(() =>
    expect(state(page)).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'token', text: '@ann' },
      { type: 'text', text: ' there soon' },
    ]),
  );
  expect(input.textContent!.replaceAll(EDGE, '')).toBe('Hi @ann there soon');
});
