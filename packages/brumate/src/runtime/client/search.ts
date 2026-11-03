// `$searchParam` in the browser. The effect of the signal writes the parameter to the URL, and
// the history writes the signal back. After the modules of the core, since it reads the scopes.
import { readParam, writeParam } from '../search-params.ts';
import type { SearchParamOptions } from '../signals.ts';
import { navigate } from '../routes.ts';
import { updateRoute } from './context.ts';
import type { Scope } from './state.ts';
import { get, pass, set } from './updates.ts';

/** A signal bound to a parameter, with the scope that holds it. */
interface Bound {
  scope: Scope;
  slot: number;
  name: string;
  options?: SearchParamOptions<unknown>;
}

/** The signals of the page that follow a parameter, by scope and slot. */
const bound = new Map<string, Bound>();
/** The changes of the URL that wait for the end of the writes of one pass. */
const waiting = new Map<string, { text: string | null; options?: SearchParamOptions<unknown> }>();

/** `$searchParam` in the browser: the parameter of the URL of the page. */
export function searchParam(name: string, options?: SearchParamOptions<unknown>): unknown {
  return readParam(new URLSearchParams(location.search), name, options);
}

/**
 * The effect of `$searchParam`: it writes the URL when the signal changes, and follows the
 * history while the scope lives.
 */
export function paramEffect(
  scope: Scope,
  slot: number,
  name: string,
  options?: SearchParamOptions<unknown>,
): () => () => void {
  return () => {
    const key = `${scope.id}:${slot}`;
    // A parameter that asks the server for the page changes the URL by navigation only.
    if (!options?.server) {
      bound.set(key, { scope, slot, name, options });
      (globalThis as Record<symbol, unknown>)[HOOK] = follow;
    }
    const text = writeParam(get(scope, slot), options);
    if (new URLSearchParams(location.search).get(name) !== text) {
      if (waiting.size === 0) {
        queueMicrotask(commit);
      }
      waiting.set(name, { text, options });
    }
    return () => void bound.delete(key);
  };
}

/** The key of the hook with which the loader asks whether a change of the URL is ours. */
const HOOK = Symbol.for('brumate.search');

/** Writes the changes of one pass to the URL, as one entry of the history. */
function commit(): void {
  const url = new URL(location.href);
  let push = false;
  let server = false;
  for (const [name, { text, options }] of waiting) {
    if (text === null) {
      url.searchParams.delete(name);
    } else {
      url.searchParams.set(name, text);
    }
    push ||= options?.history === 'push';
    server ||= options?.server === true;
  }
  waiting.clear();
  if (server) {
    void navigate(url.href, { replace: !push, scroll: false });
    return;
  }
  if (push) {
    history.pushState({}, '', url);
  } else {
    history.replaceState(history.state, '', url);
  }
  // The loader tells a change of the page from one of the query string by this event.
  document.dispatchEvent(new Event('brumate:search'));
  updateRoute();
}

/**
 * Writes the signals whose parameter changed, from `from` to the URL now. False when another
 * parameter changed, or the path did: the page loads then.
 */
function follow(from: string): boolean {
  const before = new URL(from);
  const now = new URL(location.href);
  if (before.pathname !== now.pathname) {
    return false;
  }
  const names = new Set([...before.searchParams.keys(), ...now.searchParams.keys()]);
  const changed: Bound[] = [];
  for (const name of names) {
    if (before.searchParams.getAll(name).join() === now.searchParams.getAll(name).join()) {
      continue;
    }
    const found = [...bound.values()].filter((item) => item.name === name);
    if (found.length === 0) {
      return false;
    }
    changed.push(...found);
  }
  // The writes make one pass, so the memos that read two parameters see both new values.
  pass(() => {
    for (const { scope, slot, name, options } of changed) {
      set(scope, slot, readParam(now.searchParams, name, options));
    }
  });
  updateRoute();
  return true;
}
