import { expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Counter from './src/Counter.brm?brumate-server';

it('starts at the prop and counts clicks', async () => {
  const page = await mount(Counter, { start: 3 });
  expect(page.text('button')).toBe('Clicked 3 times');
  expect(page.text('.double')).toBe('Double: 6');

  page.click('button');
  await page.waitFor(() => expect(page.text('button')).toBe('Clicked 4 times'));
  expect(page.text('.double')).toBe('Double: 8');
  page.unmount();
});

it('starts at 0 without the prop', async () => {
  const page = await mount(Counter, {});
  expect(page.text('button')).toBe('Clicked 0 times');
  page.unmount();
});
