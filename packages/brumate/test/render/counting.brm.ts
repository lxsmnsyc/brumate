// Reactive logic for components: see uses-counter.brm.
import { $memo, $signal } from 'brumate/signals';

export const STEP = 1;

export function counter(start: number): {
  count: number;
  double: number;
  increment: () => void;
  reset: () => number;
} {
  let count = $signal(start);
  const double = $memo(count * 2);

  function increment() {
    count += STEP;
  }

  return { count, double, increment, reset: () => (count = start) };
}
