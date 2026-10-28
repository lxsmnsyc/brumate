// The tests of the reset of a form, for the parts that keep a value of their own.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import FormResets from './fixtures/form-resets.brm?brumate-server';
import { EDGE } from '../src/token-field.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
});

async function resets() {
  const page = await mount(FormResets, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof resets>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

const inside = (form: string, selector: string) =>
  document.querySelector<HTMLElement>(`.${form} ${selector}`)!;
const field = (form: string, selector: string) => inside(form, selector) as HTMLInputElement;

/** The text of the box of a TokenField. */
const boxText = (form: string) => inside(form, '.message-input').textContent!.replaceAll(EDGE, '');

/** Types into an input, as the browser does: its value, then `input`. */
function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Changes every part of a form, as a user does. The first event of a part loads its code. */
async function edit(page: Page, form: string) {
  const unselected = (selector: string) =>
    page.waitFor(() => expect(inside(form, selector).hasAttribute('data-selected')).toBe(false));
  field(form, '.box input').click();
  await unselected('.box');
  field(form, '.switch input').click();
  await unselected('.switch');
  field(form, '.ham input').click();
  await unselected('.ham');
  field(form, '.egg input').click();
  field(form, '.large input').click();
  await page.waitFor(() => expect(inside(form, '.large').hasAttribute('data-selected')).toBe(true));
  const fruit = field(form, '.fruit-input');
  fruit.focus();
  type(fruit, 'ap');
  await page.waitFor(() => expect(inside(form, '.fruit').hasAttribute('data-open')).toBe(true));
  type(fruit, '');
  await page.waitFor(() => expect(field(form, '.fruit input[type=hidden]').value).toBe(''));
  type(field(form, '.search-input'), 'dogs');
  await page.waitFor(() => expect(field(form, '.search-input').value).toBe('dogs'));
  const message = inside(form, '.message-input');
  message.append(document.createTextNode(' there'));
  message.dispatchEvent(new Event('input', { bubbles: true }));
  await page.waitFor(() =>
    expect(field(form, '.message input[type=hidden]').value).toBe('hi there'),
  );
}

/** What every part shows once the form has reset, to the first value or to the value it keeps. */
function expectShown(form: string, first: boolean) {
  expect(inside(form, '.box').hasAttribute('data-selected')).toBe(first);
  expect(field(form, '.box input').checked).toBe(first);
  expect(inside(form, '.switch').hasAttribute('data-selected')).toBe(first);
  expect(field(form, '.switch input').checked).toBe(first);
  expect(inside(form, '.ham').hasAttribute('data-selected')).toBe(first);
  expect(field(form, '.ham input').checked).toBe(first);
  expect(inside(form, '.egg').hasAttribute('data-selected')).toBe(!first);
  expect(field(form, '.egg input').checked).toBe(!first);
  expect(inside(form, '.small').hasAttribute('data-selected')).toBe(first);
  expect(field(form, '.small input').checked).toBe(first);
  expect(inside(form, '.large').hasAttribute('data-selected')).toBe(!first);
  expect(field(form, '.large input').checked).toBe(!first);
  expect(field(form, '.fruit-input').value).toBe(first ? 'Apple' : '');
  expect(field(form, '.fruit input[type=hidden]').value).toBe(first ? 'apple' : '');
  expect(field(form, '.search-input').value).toBe(first ? 'cats' : 'dogs');
  expect(inside(form, '.search').hasAttribute('data-empty')).toBe(false);
  expect(boxText(form)).toBe(first ? 'hi' : 'hi there');
  expect(field(form, '.message input[type=hidden]').value).toBe(first ? 'hi' : 'hi there');
}

it('gives back the first value of every part on a reset of the form', async () => {
  const page = await resets();
  expectShown('own', true);
  await edit(page, 'own');
  expectShown('own', false);
  (inside('own', '.reset').closest('form') as HTMLFormElement).reset();
  await page.waitFor(() => expectShown('own', true));
  expect(inside('own', '.fruit').hasAttribute('data-open')).toBe(false);
});

it('sends the reset through the setter, so a setter that refuses keeps the value', async () => {
  const page = await resets();
  await edit(page, 'held');
  await page.waitFor(() =>
    expect(state(page)).toEqual([
      false,
      false,
      ['egg'],
      'large',
      null,
      '',
      'dogs',
      [{ type: 'text', text: 'hi there' }],
    ]),
  );
  page.click('.hold');
  await page.waitFor(() => expect(page.text('.held-flag')).toBe('true'));
  (inside('held', '.reset').closest('form') as HTMLFormElement).reset();
  // The parts show what the caller keeps, and so do their inputs.
  await new Promise((done) => setTimeout(done, 100));
  expectShown('held', false);
  expect(inside('held', '.fruit').hasAttribute('data-open')).toBe(false);
  expect(state(page)).toEqual([
    false,
    false,
    ['egg'],
    'large',
    null,
    '',
    'dogs',
    [{ type: 'text', text: 'hi there' }],
  ]);
});
