import { $debounced, $gate, $memo, $signal } from 'brumate/signals';

function check(value: number): number {
  if (value === 3) {
    throw new Error('three');
  }
  return value;
}

export let n: number = $signal(0);

/** A memo whose expression throws for 3. */
export const plain: number = $memo(check(n));
/** A gate whose guard throws for 3. */
export const gated: number = $gate(n, (_, next) => check(next) >= 0);
/** A debounced value whose function throws for 3, after its wait. */
export const delayed: number = $debounced(check(n), 20);
/** A sibling that reads the same signal and does not throw. */
export const double: number = $memo(n * 2);

export function set(value: number): void {
  n = value;
}
