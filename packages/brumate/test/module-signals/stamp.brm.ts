import { $memo, $signal } from 'brumate/signals';

export const calls: { stamp: number } = { stamp: 0 };

export let when: Date = $signal(new Date(0));
export let tags: Set<string> = $signal(new Set(['a']));
export let table: Map<string, number> = $signal(new Map([['k', 1]]));
export let missing: number = $signal(Number.NaN);

async function load(at: Date, list: Set<string>, map: Map<string, number>, n: number) {
  calls.stamp++;
  await new Promise((done) => setTimeout(done, 5));
  return `${at.getTime()} ${[...list].join()} ${map.get('k')} ${n}`;
}

/** A memo that loads over sources that the page state sends as a date, a set, a map and NaN. */
export const stamped: string = $memo(await load(when, tags, table, missing));

export function touch(): void {
  when = new Date(1);
}
