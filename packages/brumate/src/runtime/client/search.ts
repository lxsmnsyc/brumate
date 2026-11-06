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
/** The slots whose effect ran once. The first run is the load of the page. */
const loaded = new WeakMap<Scope, Set<number>>();
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
    // The URL never changes when the page loads: a parameter such as `?page=1` or `?page=abc`
    // stays as the user wrote it. A page rendered without the query string (a prerendered one)
    // holds another value, so the signal takes the value of the URL.
    let started = loaded.get(scope);
    if (!started) {
      started = new Set();
      loaded.set(scope, started);
    }
    const first = !started.has(slot);
    started.add(slot);
    const text = writeParam(get(scope, slot), options);
    const current = readParam(new URLSearchParams(location.search), name, options);
    if (writeParam(current, options) !== text) {
      if (first && !options?.server) {
        set(scope, slot, current);
        return () => void bound.delete(key);
      }
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
  const changes = new Map<string, string | null>();
  for (const [name, { text, options }] of waiting) {
    changes.set(name, text);
    push ||= options?.history === 'push';
    server ||= options?.server === true;
  }
  const names = new Set(waiting.keys());
  waiting.clear();
  url.search = editQuery(url.search, changes);
  if (server) {
    void navigate(url.href, { replace: !push, scroll: false });
    return;
  }
  if (push) {
    history.pushState({}, '', url);
  } else {
    history.replaceState(history.state, '', url);
  }
  // Signals of other components that follow the same parameter take the value too.
  pass(() => {
    for (const { scope, slot, name, options } of bound.values()) {
      if (names.has(name)) {
        set(scope, slot, readParam(url.searchParams, name, options));
      }
    }
  });
  // The loader tells a change of the page from one of the query string by this event.
  document.dispatchEvent(new Event('brumate:search'));
  updateRoute();
}

/** The names of the parameters in a query string, as the URL reads them. */
function queryName(piece: string): string {
  return new URLSearchParams(piece).keys().next().value ?? '';
}

/**
 * The query string with the changes made, and every other parameter as it was written. The
 * first piece of a changed name takes the new text, and its other pieces go.
 */
function editQuery(search: string, changes: Map<string, string | null>): string {
  const pieces: string[] = [];
  const done = new Set<string>();
  for (const piece of search.slice(1).split('&')) {
    const name = piece === '' ? '' : queryName(piece);
    if (!changes.has(name)) {
      if (piece !== '') {
        pieces.push(piece);
      }
      continue;
    }
    const text = changes.get(name)!;
    if (text !== null && !done.has(name)) {
      pieces.push(new URLSearchParams({ [name]: text }).toString());
    }
    done.add(name);
  }
  for (const [name, text] of changes) {
    if (text !== null && !done.has(name)) {
      pieces.push(new URLSearchParams({ [name]: text }).toString());
    }
  }
  return pieces.length > 0 ? `?${pieces.join('&')}` : '';
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
    if (same(before.searchParams.getAll(name), now.searchParams.getAll(name))) {
      continue;
    }
    let owned = false;
    for (const item of bound.values()) {
      if (item.name === name) {
        changed.push(item);
        owned = true;
      }
    }
    if (!owned) {
      return false;
    }
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

/** True for two lists of texts that are equal item by item. */
function same(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}
