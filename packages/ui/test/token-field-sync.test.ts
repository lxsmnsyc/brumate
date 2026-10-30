// The tests of the box of a TokenField that shows the kept value.
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import TokenFieldSync from './fixtures/token-field-sync.brm?brumate-server';
import { EDGE } from '../src/token-field.ts';

vi.setConfig({ testTimeout: 30000 });

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function sync() {
  const page = await mount(TokenFieldSync, {});
  unmount = page.unmount;
  // The code of the page loads.
  await wait(150);
  return page;
}

/** The box as the user sees it: its text and the tokens in it. */
function shown(box: Element) {
  return {
    text: box.textContent!.replaceAll(EDGE, ''),
    tokens: [...box.querySelectorAll('[data-token]')].map((one) => one.getAttribute('data-token')),
  };
}

function type(box: Element, text: string) {
  box.append(document.createTextNode(text));
  box.dispatchEvent(new Event('input', { bubbles: true }));
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

it('shows the kept value after a refused edit', async () => {
  const page = await sync();
  const box = page.get('.guarded-input');
  page.get('.hold').click();
  type(box, ' typed');
  await wait(100);
  expect(JSON.parse(page.text('.kept'))).toEqual([{ type: 'token', text: '@ada' }]);
  expect(shown(box)).toEqual({ text: '@ada', tokens: ['@ada'] });
});

it('shows the first value after a reset that gives back the kept one', async () => {
  const page = await sync();
  const box = page.get('.guarded-input');
  page.get('.hold').click();
  type(box, ' typed');
  await wait(100);
  (page.get('.form') as HTMLFormElement).reset();
  await wait(100);
  expect(shown(box)).toEqual({ text: '@ada', tokens: ['@ada'] });
});

it('shows the first value after quick edits and a reset', async () => {
  const page = await sync();
  const box = page.get('.own-input');
  // Backspace twice removes the token and its space, then the user types a new one.
  box.replaceChildren();
  box.dispatchEvent(new Event('input', { bubbles: true }));
  type(box, '@zed ');
  (page.get('.form') as HTMLFormElement).reset();
  await wait(200);
  expect(JSON.parse(page.text('.own-state'))).toEqual([{ type: 'token', text: '@ada' }]);
  expect(shown(box)).toEqual({ text: '@ada', tokens: ['@ada'] });
});

it('writes the same token twice with the content of each', async () => {
  const page = await sync();
  const box = page.get('.twice-input');
  type(box, ' #new ');
  await page.waitFor(() => expect(box.querySelectorAll('[data-token] .mention')).toHaveLength(3));
  expect(shown(box).tokens).toEqual(['@ada', '@ada', '#new']);
  expect([...box.querySelectorAll('[data-token] .mention')].map((one) => one.textContent)).toEqual([
    '@ada',
    '@ada',
    '#new',
  ]);
});
