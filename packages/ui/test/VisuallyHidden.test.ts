import { expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import VisuallyHidden from '../src/VisuallyHidden.brm?brumate-server';
import { press, tab, tabbables } from './interact.ts';

it('hides its content from sight, and keeps it for screen readers', async () => {
  const page = await mount(VisuallyHidden, { children: 'Only screen readers read this' });
  const element = page.get('span');
  expect(element.textContent).toBe('Only screen readers read this');
  expect(element.className).toContain('visually-hidden');
  expect(element.hasAttribute('data-focusable')).toBe(false);
  page.unmount();
});

it('renders the element of as, with the attributes of the caller, and can show on focus', async () => {
  const page = await mount(VisuallyHidden, {
    as: 'a',
    href: '#main',
    focusable: true,
    children: 'Skip to the content',
  });
  const link = page.get('a');
  expect(link.getAttribute('href')).toBe('#main');
  expect(link.hasAttribute('data-focusable')).toBe(true);
  expect(link.className).toContain('focusable');
  // The link is the first stop of Tab, as a link to skip to the content is.
  expect(tabbables()).toEqual([link]);
  expect(tab()).toBe(link);
  let pressed = '';
  link.addEventListener('keydown', (event) => (pressed = event.key));
  press('Enter');
  expect(pressed).toBe('Enter');
  page.unmount();
});

it('adds the class of the caller to its own', async () => {
  const page = await mount(VisuallyHidden, { class: 'skip', children: 'Hidden' });
  expect(page.get('span').className).toBe('visually-hidden skip');
  page.unmount();
});
