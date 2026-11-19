import { $memo, $produce, $signal } from 'brumate/signals';
import { plus } from './helpers.brm.ts';

/** The browser starts from another first value than the server, to test the repair. */
const seed = (globalThis as { seedValue?: number[] }).seedValue ?? [];

export let items: number[] = $signal<number[]>(seed);
export const total: number = $memo(items.reduce((acc, price) => acc + price, 0));
export let step: number = $signal(1);
export const label: string = $memo(`${items.length} items, ${total}`);
export let note: { text: string } = $signal({ text: 'a' });
export const runs: { double: number } = { double: 0 };
export const double: number = $memo((runs.double++, total) * 2 + step);

export function add(price: number): void {
  items = [...items, price];
}

export function bump(): void {
  step++;
  step += 2;
}

export function rename(text: string): void {
  $produce(note, (draft) => {
    draft.text = text;
  });
}

export function sum(): number {
  return total;
}

/** A module function that a component calls: its copy reads a module signal. */
export function watcher(): { seen: number } {
  const seen = $memo(items.length + 1);
  return { seen };
}

export let other: number = $signal(10);

function totalOf(list: number[]): number {
  return list.reduce((acc, price) => acc + price, 0) + other;
}

/** A memo that reads `other` only through a function that it calls. */
export const withOther: number = $memo(totalOf(items));

/** A memo that reads a signal of another module through a helper of that module. */
export const viaHelper: number = $memo(plus(step));

/** A module function that a component copies, and that writes signals of its module. */
export function tracker(): { size: number; push: () => void } {
  const size = $memo(items.length);
  function push(): void {
    items = [...items, 1];
    step++;
  }
  return { size, push };
}

function viaPrivate(): number {
  return plus(2);
}

/** Two more memos over the same imported signal, one direct and one through a local helper. */
export const first: number = $memo(plus(1));
export const second: number = $memo(viaPrivate());
