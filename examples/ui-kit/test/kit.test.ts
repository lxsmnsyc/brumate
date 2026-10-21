import { expect, it } from 'vitest';
import { answerCalls, mount } from 'virtual:brumate/testing';
import Counter from '../src/Counter.brm?brumate-server';
import Greeter from '../src/Greeter.brm?brumate-server';

it('counts', async () => {
  const page = await mount(Counter, { start: 1, label: 'Pressed' });
  expect(page.text('button')).toBe('Pressed 1 times');
  page.click('button');
  await page.waitFor(() => expect(page.text('button')).toBe('Pressed 2 times'));
  expect(page.text('p')).toBe('Double: 4');
  page.unmount();
});

it('greets with the server function', async () => {
  // The calls of the page run the server code of the package, in the test.
  const restore = answerCalls();
  const page = await mount(Greeter, { name: 'Ada' });
  page.click('button');
  await page.waitFor(() => expect(page.text('output')).toBe('Hello, Ada, from the server'));
  page.unmount();
  restore();
});
