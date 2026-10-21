import { expect, it } from 'vitest';
import { answerCalls, mount } from 'virtual:brumate/testing';
import Page from '../src/routes/index.brm?brumate-server';

it('renders and resumes the components of the kit', async () => {
  const restore = answerCalls();
  const page = await mount(Page, {});
  expect(page.text('.kit-counter')).toBe('Clicked 2 times');
  expect(page.text('.signature')).toBe('From the Greeter card');

  page.click('.kit-counter');
  await page.waitFor(() => expect(page.text('.kit-counter')).toBe('Clicked 3 times'));
  expect(page.text('.kit-double')).toBe('Double: 6');

  // A prop that the app changes updates the component of the kit.
  page.click('.rename');
  await page.waitFor(() => expect(page.text('.kit-counter')).toBe('Pressed 3 times'));

  // A server function of the kit runs on the server of the app.
  page.click('.kit-greet');
  await page.waitFor(() => expect(page.text('output')).toBe('Hello, Ada, from the server'));

  // A module of reactive logic of the kit, called by the app.
  page.click('.visit');
  await page.waitFor(() => expect(page.text('.visit')).toBe('Visits: 11'));
  page.unmount();
  restore();
});
