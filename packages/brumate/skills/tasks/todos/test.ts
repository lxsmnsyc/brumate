import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Todos from './src/Todos.brm?brumate-server';

async function add(page: Awaited<ReturnType<typeof mount>>, text: string) {
  page.input('.text', text);
  page.click('.add');
  await page.waitFor(() => expect(page.container.textContent).toContain(text));
}

it('adds, toggles and removes, and keeps the other items', async () => {
  const page = await mount(Todos, {});
  page.click('.add');
  expect(page.container.querySelectorAll('li')).toHaveLength(0);

  await add(page, 'one');
  await add(page, 'two');
  await add(page, 'three');
  expect((page.get('.text') as HTMLInputElement).value).toBe('');
  const [first, second, third] = [...page.container.querySelectorAll('li')];
  expect(first!.textContent).toContain('one');

  page.click('li:nth-child(2) span');
  await page.waitFor(() => expect(second!.classList.contains('done')).toBe(true));
  expect(first!.classList.contains('done')).toBe(false);

  page.click('li:nth-child(2) .remove');
  await page.waitFor(() => expect(page.container.querySelectorAll('li')).toHaveLength(2));
  const rest = [...page.container.querySelectorAll('li')];
  expect(rest[0]).toBe(first);
  expect(rest[1]).toBe(third);
  page.unmount();
});

it('puts the style in the loop body', () => {
  const source = readFileSync('src/Todos.brm', 'utf8');
  const loop = source.indexOf('#for');
  const style = source.indexOf('<style');
  expect(loop).toBeGreaterThan(-1);
  expect(style).toBeGreaterThan(loop);
  expect(source).toContain('${');
  expect(source).toMatch(/by\s+\w+\.id/);
});
