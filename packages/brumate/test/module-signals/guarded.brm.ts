import { $gate, $memo, $optimistic, $signal } from 'brumate/signals';

export let n: number = $signal(0);

/** Rises only. A guard that throws on 5 holds the error. */
export const rising: number = $gate(n, (prev, next) => {
  if (next === 5) {
    throw new Error('five');
  }
  return next > prev;
});

export const source: number = $memo(n * 10);
export let guessed: number = $optimistic(source);

export function setN(value: number): void {
  n = value;
}

export function guess(value: number): void {
  guessed = value;
}
