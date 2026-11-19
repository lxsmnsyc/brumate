import { $signal } from 'brumate/signals';

export let bonus: number = $signal(100);

export function plus(count: number): number {
  return count + bonus;
}
