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
import type { PageState, ScopeId, ScopeState } from './shared.ts';

/** The parts of the core that this module uses. */
type Core = Pick<typeof Client, 'hooks' | 'removeScope' | 'scopeIds' | 'scopes'>;

/** Reads an ID, as `parseId` in `shared.ts` does. This module imports no code of its own. */
function readId(text: string): ScopeId {
  return /^-?\d+$/.test(text) ? Number(text) : text;
}

/** Adds a number to an ID, as `shiftId` in `shared.ts` does. */
function shiftId(id: ScopeId, by: number): ScopeId {
  if (typeof id === 'number') {
    return id + by;
  }
  const dot = id.indexOf('.');
  return `${Number(id.slice(0, dot)) + by}${id.slice(dot)}`;
}

/** Adds a number to the scope IDs of a state record, in the places that the table names. */
export function shiftState(ids: Core['scopeIds'], state: PageState, by: number): PageState {
  const { fields, references } = ids;
  const seen = new Set<object>();
  const shiftValue = (value: unknown): unknown => {
    for (const [type, shift] of references) {
      if (value instanceof type) {
        return shift(value as never, by);
      }
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
  const shiftEach = (object: object, shift: (value: never) => unknown): object =>
    Object.fromEntries(Object.entries(object).map(([key, value]) => [key, shift(value as never)]));
  const result: PageState = {};
  for (const [key, record] of Object.entries(state)) {
    const moved: Record<string, unknown> = { ...record };
    for (const [name, kind] of Object.entries(fields)) {
      const field = moved[name];
      if (field === undefined || kind === 'none') {
        continue;
      }
      moved[name] =
        kind === 'id'
          ? shiftId(field as ScopeId, by)
          : kind === 'ids'
            ? shiftEach(field as object, (id: ScopeId) => shiftId(id, by))
            : kind === 'values'
              ? (field as unknown[]).map(shiftValue)
              : kind === 'map'
                ? shiftEach(field as object, shiftValue)
                : shiftValue(field);
    }
    result[shiftId(readId(key), by)] = moved as ScopeState;
  }
  return result;
}

/** Removes scopes and the scopes inside them, and runs their cleanups. */
function dropScopes(core: Core, roots: Set<ScopeId>): void {
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
  const value = offset ? shiftState(core.scopeIds, state, offset) : state;
  const drop = script.getAttribute('b-drop');
  if (drop) {
    dropScopes(core, new Set(drop.split(',').map(readId)));
  }
  const list = script.getAttribute('b-roots');
  if (list === null) {
    return value;
  }
  const roots = new Set(list.split(',').filter(Boolean).map(readId));
  const alias = new Map<ScopeId, ScopeId>();
  for (const pair of (script.getAttribute('b-alias') ?? '').split(',').filter(Boolean)) {
    const [from, to] = pair.split(':').map(readId) as [ScopeId, ScopeId];
    alias.set(from, to);
  }
  const kept = (id: ScopeId): boolean => {
    for (let current: ScopeId | undefined = id; current !== undefined;) {
      if (roots.has(current)) {
        return true;
      }
      const record: ScopeState | undefined = value[current];
      current = record?.p ?? record?.o;
    }
    return false;
  };
  const resolve = (id: ScopeId | undefined): ScopeId | undefined =>
    id === undefined ? undefined : (alias.get(id) ?? id);
  const result: PageState = {};
  for (const [key, record] of Object.entries(value)) {
    // The new page renders the kept layouts again. Their scopes are not added.
    const id = readId(key);
    if (kept(id)) {
      result[id] = { ...record, p: resolve(record.p), o: resolve(record.o) };
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
  ({ hooks, leavePage, leaveRoutes, removeScope, scopeIds, scopes }) => {
    const core = {
      hooks,
      removeScope,
      scopeIds,
      scopes,
    };
    hooks.record = (script, state) => routeRecord(core, script, state);
    return (partial) => (partial ? leaveRoutes() : leavePage());
  },
);
