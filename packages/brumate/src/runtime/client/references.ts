// Calls the function that a reference names, such as `Page#h3`, once its code has loaded.

import { loadOnce } from '../skew.ts';
import { codeReady, loadModule, loadPart } from './code.ts';
import { build, partOf, rpcPrefix, skew } from './state.ts';
import type { Scope } from './state.ts';

export type Handler = (scope: Scope | undefined, ...args: unknown[]) => unknown;

/** Waits forever once the page loads again, so no error shows before it goes. */
let reloading: Promise<never> | undefined;

export async function resolve(ref: string): Promise<Handler> {
  const [id, name] = ref.split('#') as [string, string];
  try {
    const module = await loadModule(id);
    const part = await loadPart(module, partOf(name));
    return part[name] as Handler;
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
  const started = lastCall.then(() => loaded).then((fn) => ({ value: fn(scope, ...args) }));
  lastCall = started.catch(() => {});
  return started.then((result) => result.value);
}
