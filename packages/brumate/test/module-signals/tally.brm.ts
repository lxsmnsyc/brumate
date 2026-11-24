import { $memo, $signal } from 'brumate/signals';

/** The browser can start from another first value than the server, to test the repair. */
const seed = (globalThis as { tallySeed?: number[] }).tallySeed ?? [];

export let marks: number[] = $signal<number[]>(seed);
export const count: number = $memo(marks.length);
/** A sync memo whose value holds a promise, which is no value that loaded. */
export const pair: [Promise<number>, string] = $memo([Promise.resolve(marks.length), 'pair']);

export function fill(n: number): void {
  marks = Array.from({ length: n }, (_, index) => index);
}
