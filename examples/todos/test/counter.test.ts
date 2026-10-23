import { expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Counter from '../src/Counter.brm?brumate-server';

it('counts after the page resumes', async () => {
  const page = await mount(Counter, { start: 1 });
  expect(page.text('button')).toBe('Clicked 1 times');
  // The click loads the handler, so its update arrives a moment later.
  page.click('button');
  await page.waitFor(() => expect(page.text('button')).toBe('Clicked 2 times'));
  expect(page.text('.double')).toBe('Double: 4');
  page.unmount();
});
