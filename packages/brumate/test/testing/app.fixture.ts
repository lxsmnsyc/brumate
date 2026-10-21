// Run by test/testing.test.ts, in happy-dom, with the brumate plugin.
import { afterEach, beforeEach, expect, it } from 'vitest';
import { answerCalls as answerWith } from 'brumate/testing';
import { functions } from 'virtual:brumate/server';
import { answerCalls, mount } from 'virtual:brumate/testing';
import Notes from './Notes.brm?brumate-server';
import { addNote, listNotes } from './notes.ts';
import { notes } from './store.ts';

const idOf = (name: string): string =>
  Object.keys(functions).find((id) => id.endsWith(`#${name}`))!;
const items = (page: { container: HTMLElement }): string[] =>
  [...page.container.querySelectorAll('li')].map((item) => item.textContent ?? '');

const original = globalThis.fetch;
let calls: string[] = [];

beforeEach(() => {
  notes.splice(0, notes.length, 'First');
  calls = [];
});

afterEach(() => {
  globalThis.fetch = original;
});

it('runs the real server functions, while the test gets the stubs', async () => {
  globalThis.fetch = (() => {
    throw new Error('No fetch');
  }) as typeof fetch;
  // The registry has the server code, which runs without fetch.
  // addNote reads the event of a request, which a direct call has none of.
  await expect(functions[idOf('addNote')]!('Direct')).rejects.toThrow('getEvent()');
  expect(await functions[idOf('listNotes')]!()).toEqual(['First']);
  // The test imports the browser stubs, which call fetch.
  await expect(listNotes()).rejects.toThrow('No fetch');
});

it('answers the calls of a mounted component with the server code', async () => {
  const restore = answerCalls({ onCall: (id) => calls.push(id.split('#')[1]!) });
  const page = await mount(Notes, {});
  // The server render called listNotes in the process, not through fetch.
  expect(items(page)).toEqual(['First']);
  expect(calls).toEqual([]);

  page.click('.add');
  await page.waitFor(() => expect(items(page)).toEqual(['First', 'Second']));
  expect(notes).toEqual(['First', 'Second']);
  expect(calls).toEqual(['addNote', 'listNotes']);

  // A server function of the component.
  page.click('.count');
  await page.waitFor(() => expect(page.text('.total')).toBe('2'));
  expect(calls.at(-1)).toBe('count');

  // A stub that the test calls goes through the same answer.
  await addNote('Third');
  expect(notes).toEqual(['First', 'Second', 'Third']);
  page.unmount();

  restore();
  expect(globalThis.fetch).toBe(original);
});

it('throws when a server function calls a stub, instead of calling itself without end', async () => {
  const restore = answerWith({ [idOf('listNotes')]: listNotes });
  await expect(listNotes()).rejects.toThrow('called "' + idOf('listNotes') + '" through fetch');
  restore();
});

it('sends other requests to the fetch from before', async () => {
  globalThis.fetch = (async () => new Response('elsewhere')) as typeof fetch;
  const restore = answerCalls();
  expect(await (await fetch('/other')).text()).toBe('elsewhere');
  restore();
});
