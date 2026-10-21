import { $memo, $signal } from 'brumate/signals';

/** A count that starts at `start`, with its double. */
export function counter(start: number) {
  let count = $signal(start);
  const double = $memo(count * 2);

  function increment() {
    count++;
  }

  return { count, double, increment };
}
