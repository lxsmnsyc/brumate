import { derived, store } from 'brumate/store';
import type { Store, StoreLike } from 'brumate/store';

export const cart: Store<number[]> = store([12, 8]);

export const total: StoreLike<number> = derived(cart, (prices) =>
  prices.reduce((sum, price) => sum + price, 0),
);
