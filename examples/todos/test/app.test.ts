import { expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import App from '../src/App.brm?brumate-server';

it('toggles a todo, streams the quote, and resumes the counter inside it', async () => {
  const page = await mount(App, {
    initial: [
      { id: '1', title: 'Write the docs', done: false },
      { id: '2', title: 'Ship it', done: false },
    ],
  });
  expect(page.text('.left')).toBe('2 left');
  page.click('li button');
  await page.waitFor(() => expect(page.text('.left')).toBe('1 left'));
  expect(page.get('li').className).toBe('done');

  // The quote streams in after the rest of the page.
  expect(page.container.textContent).toContain('Loading a quote');
  await page.waitFor(
    () => expect(page.text('blockquote')).toBe('Ship less code to the browser.'),
    3000,
  );

  page.click('.count');
  await page.waitFor(() => expect(page.text('.count')).toBe('Clicked 4 times'));
  page.unmount();
});
