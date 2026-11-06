// Calls the function that a reference names, such as `Page#h3`, once its code has loaded.

import { HAS_BINDINGS } from '../features.ts';
import { loadOnce } from '../skew.ts';
import { codeReady, loadModule, loadedFunction } from './code.ts';
import { build, rpcPrefix, skew } from './state.ts';
import type { Scope } from './state.ts';
import type { FunctionReference } from '../shared.ts';

/**
 * The handlers that the core makes from references, with their references,
 * so a spread in markup that the browser renders passes them on in `b-on`,
 * as a spread on the server does.
 */
export const handlerReferences: WeakMap<object, FunctionReference> = new WeakMap();

export type Handler = (scope: Scope | undefined, ...args: unknown[]) => unknown;

/** Waits forever once the page loads again, so no error shows before it goes. */
let reloading: Promise<never> | undefined;

export async function resolve(ref: string): Promise<Handler> {
  const [id, name] = ref.split('#') as [string, string];
  try {
    const module = await loadModule(id);
    return (module as unknown as Record<string, Handler>)[name]!;
  } catch (error) {
    // After a deploy, the files of a build can be gone. The page loads again, with the new code,
    // once for each build. Any other error, such as a module that throws, goes to `#try`.
    const next = await serverBuild();
    if (!reloading && next !== undefined && loadOnce(next)) {
      skew('code');
      location.reload();
      reloading = new Promise(() => {});
    }
    if (reloading) {
      return reloading;
    }
    throw error;
  }
}

/**
 * Asks the server for its build, after the code of a handler failed to
 * load. Returns it when it is not the build of the page. Undefined without
 * a build, when the request fails, or when the builds are the same.
 */
async function serverBuild(): Promise<string | undefined> {
  if (build === undefined) {
    return undefined;
  }
  try {
    const response = await fetch(`${rpcPrefix}/`, {
      method: 'POST',
      headers: { 'x-brumate-build': build },
    });
    const current = response.headers.get('x-brumate-build');
    return current !== null && current !== build ? current : undefined;
  } catch {
    return undefined;
  }
}

// Runs a call as a pass. `updates.ts` sets it, since it imports this module.
let inPass: <T>(run: () => T) => T = (run) => run();

export function setPass(pass: <T>(run: () => T) => T): void {
  inPass = pass;
}

// The calls that wait for their turn or their code.
let waiting = 0;

/**
 * Calls a function of another component at once, as a pass, when its code has loaded and no call
 * waits before it, so the caller reads what the function wrote. Returns false when it did not
 * call, and `call` is the way then.
 */
export function callNow(ref: string, scope: Scope | undefined, args: unknown[]): boolean {
  const fn = waiting === 0 && !codeReady() ? loadedFunction(ref) : undefined;
  if (!fn) {
    return false;
  }
  track(inPass(() => fn(scope, ...args)));
  return true;
}

// The setter calls that have not settled: waiting for a turn or code, or running an async function.
const unsettled = new Set<Promise<unknown>>();

/** Holds the result of a setter, when it is a promise, until it settles. */
export function track(result: unknown): void {
  if (HAS_BINDINGS && result && typeof (result as PromiseLike<unknown>).then === 'function') {
    // The gate never rejects. The error goes on through the promise that `then` returns, so it is
    // reported once, as before.
    let open!: () => void;
    const gate = new Promise<void>((done) => {
      open = done;
    });
    unsettled.add(gate);
    void (result as PromiseLike<unknown>).then(
      () => {
        unsettled.delete(gate);
        open();
      },
      (error: unknown) => {
        unsettled.delete(gate);
        open();
        throw error;
      },
    );
  }
}

/**
 * Resolves once the setter calls made so far have settled, whether they kept the write or not.
 * Returns undefined when none waits or runs, so the caller can act at once.
 */
export function whenSettled(): Promise<void> | undefined {
  if (unsettled.size === 0) {
    return undefined;
  }
  return Promise.all(unsettled).then(() => {});
}

// The previous call of a function prop or a provided function, once it has started.
let lastCall: Promise<unknown> = Promise.resolve();

/**
 * Calls a function of another component, such as a function prop or a provided function. The
 * code of each loads in parallel, but the calls start in the order that they were made, so an
 * `onChange` that an input event calls runs before an `onKeyDown` of a later key. The result is
 * wrapped, so a call that its code makes does not wait for the call around it.
 */
export function call(ref: string, scope: Scope | undefined, args: unknown[]): Promise<unknown> {
  const code = codeReady();
  const loaded = code ? Promise.all([resolve(ref), code]).then(([fn]) => fn) : resolve(ref);
  waiting++;
  const started = lastCall
    .then(() => loaded)
    // A call whose code fails to load stops waiting too, so the next setter can run at once.
    .finally(() => {
      waiting--;
    })
    .then((fn) => ({ value: inPass(() => fn(scope, ...args)) }));
  lastCall = started.catch(() => {});
  return started.then((result) => result.value);
}
