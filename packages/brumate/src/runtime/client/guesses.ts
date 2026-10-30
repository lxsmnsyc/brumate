// The guesses of `$optimistic` values, and the count of server calls that puts them back.

import { guesses, scopes, setGuesses } from './state.ts';
import type { Scope } from './state.ts';
import { pending, set } from './updates.ts';

/** The values of promises that the server streamed, so a guess knows its source did not change. */
export const settled: WeakMap<Promise<unknown>, unknown> = new WeakMap();

/** True while the source of a guess holds the value it had when the guess was made. */
function sameSource(key: string): boolean {
  const entry = guesses!.map.get(key);
  if (!entry?.source) {
    return false;
  }
  const current = entry.source[0].s[entry.source[1]];
  return (
    Object.is(current, entry.base) ||
    (entry.base instanceof Promise && settled.get(entry.base) === current)
  );
}

/** Server calls that have not finished, from forms and from `rpc`. */
export let calling: number = 0;

/** Counts the pages that client navigation left, so calls of an old page are not counted down. */
export let callEpoch: number = 0;

/** Calls of the old page that are still out no longer count for its guesses. */
export function leaveGuesses(): void {
  calling = 0;
  callEpoch++;
}

/**
 * Writes a guess into an optimistic value. It goes back to its source when
 * the source changes, which computes it again, or when every server call of
 * the page finishes, such as after a post failed.
 */
export function guess<T>(
  scope: Scope,
  slot: number,
  ...rest: [value: T] | [sourceScope: Scope, sourceSlot: number, value: T]
): T {
  const value = rest.at(-1) as T;
  const source = rest.length === 3 ? ([rest[0], rest[1]] as [Scope, number]) : undefined;
  const base = source && source[0].s[source[1]];
  const held = guesses ?? setGuesses({ map: new Map(), same: sameSource, reset: resetGuesses });
  held.map.set(`${scope.id}:${slot}`, { scope, slot, source, base });
  return set(scope, slot, value);
}

/** Counts a server call, and puts guesses back when the last one finishes. */
export function track<T>(request: Promise<T>): Promise<T> {
  calling++;
  const epoch = callEpoch;
  function done(): void {
    if (epoch !== callEpoch) {
      return;
    }
    calling--;
    // Waits a task, so memos that the answer refreshed start to load first.
    setTimeout(() => calling || guesses?.reset(), 0);
  }
  request.then(done, done);
  return request;
}

function resetGuesses(): void {
  for (const [key, { scope, slot, source }] of guesses!.map) {
    // A source that loads again, such as a refreshed list, resets the guess when it arrives.
    if (source && pending(source[0], source[1])) {
      continue;
    }
    guesses!.map.delete(key);
    if (source && scopes.has(scope.id) && !Object.is(scope.s[slot], source[0].s[source[1]])) {
      set(scope, slot, source[0].s[source[1]]);
    }
  }
}
