import { $signal } from 'brumate/signals';

/** A signal of a module that a page fills with the call of a `#template`. */
export let row: unknown = $signal(0);

export function setRow(value: unknown): void {
  row = value;
}
