import { derived, store } from 'brumate/store';
import type { Store, StoreLike } from 'brumate/store';

/** A source at module level; the render test counts its listeners. */
export const cart: Store<number[]> = store<number[]>([1, 2]);
export const total: StoreLike<number> = derived(cart, (items) =>
  items.reduce((sum, price) => sum + price, 0),
);
export const label: StoreLike<string> = derived(
  [cart, total],
  ([items, sum]) => `${items.length} items, ${sum}`,
);
