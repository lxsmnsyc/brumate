import {
  $debounced,
  $gate,
  $memo,
  $optimistic,
  $signal,
  $throttled,
  $untrack,
} from 'brumate/signals';

export let input: string = $signal('');
export const runs: { label: number; gate: number } = { label: 0, gate: 0 };

/** Takes the input once it has two characters. */
export const query: string = $gate(input, (_, next) => (runs.gate++, next.length >= 2));
export const typed: string = $debounced(input, 200);
export const slow: string = $throttled(input, 200);
/** Reads the length without tracking it. */
export const label: string = $memo((runs.label++, `${query} (${$untrack(input.length)})`));
/** A memo over a debounced value is pending while the value waits. */
export const loud: string = $memo(typed.toUpperCase());
/** Follows a memo of the input and holds a guess from an exported function. */
export const shouting: string = $memo(input.toUpperCase());
export let shown: string = $optimistic(shouting);

export function type(text: string): void {
  input = text;
}

export function guess(text: string): void {
  shown = text;
}
