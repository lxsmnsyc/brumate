import { expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Counter from '../src/Counter.brm?brumate-server';

it('mounts one after another', async () => {
  const first = await mount(Counter, { start: 1 });
  first.click('button');
  await first.waitFor(() => expect(first.text('button')).toBe('Clicked 2 times'));
  first.unmount();
  const second = await mount(Counter, { start: 5 });
  second.click('button');
  await second.waitFor(() => expect(second.text('button')).toBe('Clicked 6 times'));
  second.unmount();
});

it('mounts two at once', async () => {
  const a = await mount(Counter, { start: 1 });
  const b = await mount(Counter, { start: 10 });
  b.click('button');
  await b.waitFor(() => expect(b.text('button')).toBe('Clicked 11 times'));
  a.click('button');
  await a.waitFor(() => expect(a.text('button')).toBe('Clicked 2 times'));
  expect(b.text('button')).toBe('Clicked 11 times');
  a.unmount();
  b.unmount();
});
