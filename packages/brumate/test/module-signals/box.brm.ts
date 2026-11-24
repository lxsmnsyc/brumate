import { $memo, $signal } from 'brumate/signals';

/** A class instance, which the page state cannot send. */
export class Box {
  n: number;

  constructor(n: number) {
    this.n = n;
  }

  twice(): number {
    return this.n * 2;
  }
}

export let box: Box = $signal(new Box(3));
export const boxed: number = $memo(box.twice());

export function grow(): void {
  box = new Box(box.n + 1);
}

/** Many rows: a memo of their count sends the count only. */
export let rows: { id: number }[] = $signal(Array.from({ length: 5000 }, (_, id) => ({ id })));
export const count: number = $memo(rows.length);
