// What the core needs to read the pages that client navigation adds. Only
// `navigate.ts` writes the attributes that this module reads, so the loader
// imports it when it navigates or finds such a record, and a page that never
// navigates does not load it. Importing it sets the core's `record` hook.
//
// It reads the core with `import()`, as `rpc.ts` does, and imports nothing
// else. A static import of the core would make the package build move the
// core into a chunk behind a module that only re-exports it, and a static
// import of `shared.ts` would split that module out of the core of a page.
// The core is loaded already, or loads with this module.

import type * as Client from './client.ts';
import type { Scope } from './client.ts';
import type { PageState, ScopeState } from './shared.ts';

/** The parts of the core that this module uses. */
type Core = Pick<
  typeof Client,
  'ElementReference' | 'FunctionReference' | 'hooks' | 'removeScope' | 'scopes'
>;

/** Adds a number to the scope IDs of a state record. */
function shiftState(core: Core, state: PageState, by: number): PageState {
  const { ElementReference, FunctionReference } = core;
  const seen = new Set<object>();
  // References to elements and client functions name the scope of their markup.
  const shiftValue = (value: unknown): unknown => {
    if (value instanceof ElementReference) {
      return new ElementReference(value.scope + by, value.anchor);
    }
    if (value instanceof FunctionReference) {
      return new FunctionReference(value.ref, value.scope + by);
    }
    // A later record settles it, with a value whose IDs move too.
    if (value instanceof Promise) {
      return value.then(shiftValue);
    }
    if (typeof value === 'object' && value !== null && !seen.has(value)) {
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          value[index] = shiftValue(item);
        });
      } else if (Object.getPrototypeOf(value) === Object.prototype) {
        for (const [key, item] of Object.entries(value)) {
          (value as Record<string, unknown>)[key] = shiftValue(item);
        }
      }
    }
    return value;
  };
  const result: PageState = {};
  for (const [key, record] of Object.entries(state)) {
    result[Number(key) + by] = {
      ...record,
      p: record.p === undefined ? undefined : record.p + by,
      o: record.o === undefined ? undefined : record.o + by,
      c:
        record.c &&
        Object.fromEntries(Object.entries(record.c).map(([anchor, id]) => [anchor, id + by])),
      s: record.s?.map(shiftValue),
    };
  }
  return result;
}

/** Removes scopes and the scopes inside them, and runs their cleanups. */
function dropScopes(core: Core, roots: Set<number>): void {
  const inside = (scope: Scope): boolean => {
    for (let current: Scope | undefined = scope; current; current = current.p ?? current.o) {
      if (roots.has(current.id)) {
        return true;
      }
    }
    return false;
  };
  // Deleting from a map while iterating it is safe.
  for (const scope of core.scopes.values()) {
    if (inside(scope)) {
      core.removeScope(scope);
    }
  }
}

/**
 * Reads the attributes that navigation set on a state record. A page whose
 * IDs started at another number, such as a prerendered file, has them moved
 * with `b-offset`. A page that replaced only some routes of the one before
 * it drops the old routes with `b-drop`, and adds only the scopes inside
 * `b-roots`, with the scopes of the kept layouts in place of the new
 * page's copies of them, by `b-alias`.
 */
function routeRecord(core: Core, script: Element, state: PageState): PageState {
  // Only records with scopes hold IDs. Later records settle promises, which `shiftState` wraps.
  const offset = Number(script.getAttribute('b-offset') ?? 0);
  const value = offset ? shiftState(core, state, offset) : state;
  const drop = script.getAttribute('b-drop');
  if (drop) {
    dropScopes(core, new Set(drop.split(',').map(Number)));
  }
  const list = script.getAttribute('b-roots');
  if (list === null) {
    return value;
  }
  const roots = new Set(list.split(',').filter(Boolean).map(Number));
  const alias = new Map<number, number>();
  for (const pair of (script.getAttribute('b-alias') ?? '').split(',').filter(Boolean)) {
    const [from, to] = pair.split(':').map(Number) as [number, number];
    alias.set(from, to);
  }
  const kept = (id: number): boolean => {
    for (let current: number | undefined = id; current !== undefined;) {
      if (roots.has(current)) {
        return true;
      }
      const record: ScopeState | undefined = value[current];
      current = record?.p ?? record?.o;
    }
    return false;
  };
  const resolve = (id: number | undefined): number | undefined =>
    id === undefined ? undefined : (alias.get(id) ?? id);
  const result: PageState = {};
  for (const [key, record] of Object.entries(value)) {
    // The new page renders the kept layouts again. Their scopes are not added.
    if (kept(Number(key))) {
      result[Number(key)] = { ...record, p: resolve(record.p), o: resolve(record.o) };
    }
  }
  return result;
}

/**
 * Settles once the core reads records with this module, with the function
 * that forgets the page before navigation replaces it, or only stops reading
 * when layouts stay.
 */
export const ready: Promise<(partial: boolean) => void> = import('./client.ts').then(
  ({ ElementReference, FunctionReference, hooks, leavePage, leaveRoutes, removeScope, scopes }) => {
    const core = { ElementReference, FunctionReference, hooks, removeScope, scopes };
    hooks.record = (script, state) => routeRecord(core, script, state);
    return (partial) => (partial ? leaveRoutes() : leavePage());
  },
);
