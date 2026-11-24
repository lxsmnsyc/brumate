import { $debounced, $gate, $memo, $signal, $throttled } from 'brumate/signals';

/** The loads that each memo started, in this instance of the module. */
export const calls: { user: number; label: number; steps: number } = {
  user: 0,
  label: 0,
  steps: 0,
};

export let id: number = $signal(1);

/** The load of user 2 is slower than the others, to test that only the latest run is written. */
function delay(n: number): Promise<void> {
  return new Promise((done) => setTimeout(done, n === 2 ? 120 : 10));
}

async function fetchUser(n: number): Promise<{ id: number; name: string }> {
  calls.user++;
  await delay(n);
  if (n === 13) {
    throw new Error('thirteen');
  }
  return { id: n, name: `user ${n}` };
}

function fetchLabel(n: number): Promise<string> {
  calls.label++;
  return delay(n).then(() => `label ${n}`);
}

async function* countTo(n: number): AsyncGenerator<string> {
  calls.steps++;
  for (let step = 1; step <= n; step++) {
    // oxlint-disable-next-line no-await-in-loop -- The values come one at a time.
    await delay(n);
    yield `step ${step} of ${n}`;
  }
}

/** A memo that awaits. */
export const user: { id: number; name: string } = $memo(await fetchUser(id));
/** A memo whose value is a promise. */
export const label: string = $memo(fetchLabel(id));
/** A memo whose value is an async iterable. */
export const steps: string = $memo(countTo(id));
/** A memo of the module that reads a memo that loads. */
export const shout: string = $memo(user.name.toUpperCase());

/** The forms over a memo that loads. The gate refuses user 4. */
export const gatedName: string = $gate(user.name, (_, next) => next !== 'user 4');
export const slowName: string = $debounced(user.name, 20);
export const steadyName: string = $throttled(user.name, 20);

export function setId(next: number): void {
  id = next;
}

/** Module code that reads the memo, as a handler calls it. */
export function logName(): string {
  return user.name;
}
