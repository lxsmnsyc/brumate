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
