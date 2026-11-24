// Effects and `$client` callbacks with an `async` callback. The compiler calls `asyncEffect` for
// them and `effect` for the rest, so a page without one does not load this file.

import { fail } from './errors.ts';
import { DEV, devtools, hiding, scopes } from './state.ts';
import type { Scope } from './state.ts';
import { NotReady, enterEffect, reportCleanup, skipEffect, toCleanup } from './updates.ts';

/** What one effect of one scope remembers between its runs. */
interface Run {
  /** True while a run or a cleanup is in progress. */
  busy?: boolean;
  /** A change, or a body that showed, came while it was busy. */
  again?: boolean;
  /** The cleanup of the last run that settled, until it runs. */
  cleanup?: () => void;
  callback: () => unknown;
  client?: boolean;
}

const runs: WeakMap<Scope, Map<string, Run>> = new WeakMap();

/**
 * Runs an async effect, or a `$client` callback when `client` is set. One run goes at a time: a
 * change while it is busy makes one run after it, and after its cleanup, has settled.
 */
export function asyncEffect(
  scope: Scope,
  name: string,
  callback: () => unknown,
  client?: boolean,
): void {
  // In a hidden `#offscreen` body, it runs when the body shows.
  if (hiding?.paused(scope, name)) {
    return;
  }
  let byName = runs.get(scope);
  if (!byName) {
    byName = new Map();
    runs.set(scope, byName);
  }
  let run = byName.get(name);
  if (!run) {
    run = { callback };
    byName.set(name, run);
  }
  run.callback = callback;
  run.client = client;
  if (run.busy) {
    run.again = true;
    return;
  }
  scope.cleanups ??= new Map();
  // Set before the callback runs, so a write in its synchronous part makes one run after it.
  run.busy = true;
  const own = run;
  const token = { gone: false };
  scope.cleanups.set(name, () => stop(scope, name, own, token));
  hold(scope, name, run, execute(scope, name, run, token));
}

/** Marks the run as busy until its work settles, and starts the run that waited. */
function hold(scope: Scope, name: string, run: Run, work: Promise<void>): void {
  run.busy = true;
  void work.then(() => {
    run.busy = false;
    if (run.again) {
      run.again = false;
      if (scopes.get(scope.id) === scope) {
        asyncEffect(scope, name, run.callback, run.client);
      }
    }
  });
}

/**
 * The cleanup that the scope calls when a body hides, a scope goes or a page is left. It never
 * waits. A run that is pending cleans up when it settles, and an idle one cleans up at once.
 */
function stop(scope: Scope, name: string, run: Run, token: { gone: boolean }): void {
  token.gone = true;
  const cleanup = run.cleanup;
  if (!run.busy && cleanup) {
    run.cleanup = undefined;
    hold(scope, name, run, clean(scope, cleanup));
  }
}

/** Runs a cleanup and waits for it. A failure goes to `#try`. */
async function clean(scope: Scope, cleanup: () => unknown): Promise<void> {
  try {
    await cleanup();
  } catch (error) {
    fail(scope, error);
  }
}

async function execute(
  scope: Scope,
  name: string,
  run: Run,
  token: { gone: boolean },
): Promise<void> {
  // The run before: its cleanup settles first.
  const before = run.cleanup;
  if (before) {
    run.cleanup = undefined;
    await clean(scope, before);
    // The changes that came meanwhile are this run, which reads the values of the moment.
    run.again = false;
  }
  if (token.gone) {
    return;
  }
  const start = DEV ? performance.now() : 0;
  let value: unknown;
  if (DEV) {
    devtools()?.effect?.(scope, name, 'pending', 0);
  }
  try {
    value = await enterEffect(scope, name, run.callback, run.client);
  } catch (error) {
    if (error instanceof NotReady) {
      // The read was before the first `await`. After one, the read fails with its own message.
      if (DEV) {
        devtools()?.effect?.(scope, name, 'skip', 0);
      }
      skipEffect(scope, name, error, () => asyncEffect(scope, name, run.callback, run.client));
      return;
    }
    if (DEV) {
      devtools()?.effect?.(scope, name, 'run', performance.now() - start);
    }
    fail(scope, error);
    return;
  }
  const cleanup = toCleanup(value);
  const stored = reportCleanup(scope, name, cleanup, start);
  if (token.gone) {
    // Stale: the scope or body went while it was pending, so nothing runs it again.
    await clean(scope, stored);
    return;
  }
  run.cleanup = stored;
}
