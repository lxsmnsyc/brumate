import { $memo, $signal } from 'brumate/signals';

export let tick: number = $signal(0);
export const parity: string = $memo(tick % 2 ? 'odd' : 'even');
export let peeked: string = $signal('');

/**
 * Module code that reads the memo while no component follows it, then changes its source, as a
 * handler can before a block opens a component that reads the memo.
 */
export function peekThenBump(): void {
  peeked = parity;
  tick++;
}
