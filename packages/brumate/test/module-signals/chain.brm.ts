import { $memo } from 'brumate/signals';
import { items, add } from './cart.brm.ts';

/** A module that reads a signal of another module. */
export const twice: number = $memo(items.length * 2);

export function count(): number {
  return items.length;
}

export function addTwo(): void {
  add(1);
  add(2);
}
