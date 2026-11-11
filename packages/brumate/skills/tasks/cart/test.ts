import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import { cart, total } from './src/cart.ts';
import Cart from './src/Cart.brm?brumate-server';

it('computes the total from the store', () => {
  expect(cart.get()).toEqual([12, 8]);
  expect(total.get()).toBe(20);
  expect('set' in total).toBe(false);
});

it('uses derived and shows the total', async () => {
  expect(readFileSync('src/cart.ts', 'utf8')).toContain('derived(');
  const page = await mount(Cart, {});
  expect(page.text('.total')).toBe('Total 20');

  page.click('.add');
  await page.waitFor(() => expect(page.text('.total')).toBe('Total 25'));
  page.unmount();
  cart.set([12, 8]);
});
