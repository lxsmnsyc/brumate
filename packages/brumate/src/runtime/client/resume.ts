// Reads the state of the page and starts the core: the state records, the scopes they hold, and
// what leaving a page or some routes drops.

import { HAS_BINDINGS, HAS_FIELDS, HAS_LATE_MARKUP, HAS_TRIES } from '../features.ts';
import {
  CHILDREN,
  ElementReference,
  ITEM,
  ITEM_SLOT,
  MODULE,
  OWNER,
  PREFIX,
  SOURCE,
  isPropWrapper,
  isSlotReference,
  parseId,
  stateValues,
  useSerialEntry,
} from '../shared.ts';
import type { PackedState, PageState, ScopeId, ScopeState } from '../shared.ts';
import {
  findElement,
  indexMarkers,
  observeMarkers,
  rendered,
  stopObserving,
  unindexed,
} from './blocks.ts';
import { loadComponent, pageComponents } from './code.ts';
import { leaveGuesses, settled } from './guesses.ts';
import { failBoundary, replaceTry } from './errors.ts';
import { callable, handle, isBox, resetHandler } from './handlers.ts';
import { refresh } from './insert.ts';
import { removeScope, resetIds, treeChanged } from './scopes.ts';
import {
  DEV,
  comments,
  configure,
  devtools,
  elements,
  guesses,
  hooks,
  loading,
  loadingSlots,
  loads,
  memoControllers,
  modules,
  options,
  refs,
  loadingValues,
  renderedLoads,
  scopes,
  setHiding,
  timers,
} from './state.ts';
import type { CoreOptions, Scope } from './state.ts';
import { watchTitles } from './titles.ts';
import { give, pendingEffects, resetWrites, send, set, writes } from './updates.ts';

/**
 * A state record: its script, and its code, which seroval wrote. The code
 * takes the references of its render and the functions that make brumate's
 * values, and returns the value of the record.
 */
type StateRecord = [
  script: HTMLScriptElement | null,
  code: (refs: unknown[], values: typeof stateValues) => unknown,
];

/**
 * The records that ran before the core started, or while it stopped. Each
 * state script hands its record to `push`, which the core replaces while it
 * runs, so it reads later records at once.
 */
function stateQueue(): StateRecord[] {
  const global = globalThis as { $brm?: StateRecord[] };
  return (global.$brm ??= []);
}

/** Reads the records that later state scripts hand over. Set while the core runs. */
function pushRecords(...added: StateRecord[]): number {
  for (const record of added) {
    readRecord(record);
  }
  return 0;
}

/**
 * Reads a state record. The first record holds the page state, and later
 * records settle the promises in it.
 */
function readRecord([script, code]: StateRecord): void {
  // A record of a page that navigation replaced before the core started.
  if (!script?.isConnected) {
    return;
  }
  const root = script.getAttribute('b-root') ?? '0';
  if (!refs.has(root)) {
    refs.set(root, []);
  }
  const decoded = code(refs.get(root)!, stateValues);
  // The `#catch` body of a `#try` around a `#loading` body that failed on the server.
  const catches = HAS_TRIES ? script.getAttribute('b-catch') : null;
  if (catches !== null) {
    replaceTry(catches);
    return;
  }
  // The error of a `#loading` body that failed on the server, with no `#try` around it.
  const failed = HAS_LATE_MARKUP ? script.getAttribute('b-fail') : null;
  if (failed !== null) {
    failBoundary(decoded);
    return;
  }
  // Records with scopes: the page state, and the state of each `#loading` body.
  if (script.hasAttribute('b-scopes')) {
    const unpacked = unpackState(decoded as PackedState);
    const added = addScopes(hooks.record ? hooks.record(script, unpacked) : unpacked, root);
    if (writes > 0) {
      refresh(added);
    }
  }
}

/** Reads the groups of scope records back into one record per scope. See `PackedState`. */
function unpackState(state: PackedState): PageState {
  // Items to take from the list in a slot of another record, once every record is read.
  const taken: [records: ScopeState[], source: ScopeId, slot: number, first: number][] = [];
  for (const group of state.g ?? []) {
    const [k, base, flags] = group as number[];
    const count = group[3] as number;
    let at = 4;
    const m = flags & MODULE ? (group[at++] as string) : undefined;
    const source: ScopeState[] | undefined = flags & SOURCE ? [] : undefined;
    if (source) {
      taken.push([source, group[at++] as ScopeId, group[at++] as number, flags & ITEM_SLOT]);
    }
    // Scopes inside a `#loading` body: their IDs are this prefix and a number.
    const prefix = flags & PREFIX ? (group[at++] as string) : '';
    function id(n: number): ScopeId {
      return prefix ? prefix + n : n;
    }
    // The first slot of a taken item is not written. The gap before the slots holds its place.
    const skip = source && flags & ITEM_SLOT ? 1 : 0;
    let n = flags & (OWNER | PREFIX) ? 0 : base;
    while (at < group.length) {
      n += group[at++] as number;
      const s = group.slice(at - skip, (at += count - skip));
      const record: ScopeState = flags & OWNER ? { k, o: id(n - base) } : { k, p: base };
      record.s = s;
      if (m !== undefined) {
        record.m = m;
      }
      if (source) {
        source.push(record);
      } else if (flags & ITEM_SLOT) {
        record.i = s[0];
      } else if (flags & ITEM) {
        record.i = group[at++];
      }
      if (flags & CHILDREN) {
        record.c = group[at++] as Record<number, ScopeId>;
      }
      state[id(n)] = record;
    }
  }
  delete state.g;
  for (const [records, source, slot, first] of taken) {
    // An array, or a Set, whose order the state keeps.
    const values = Array.from(state[source]!.s![slot] as Iterable<unknown>);
    for (let n = 0; n < records.length; n++) {
      const record = records[n]!;
      record.i = values[n];
      if (first) {
        record.s![0] = values[n];
      }
    }
  }
  return state;
}

function addScopes(state: PageState, root: string): Scope[] {
  const added: Scope[] = [];
  for (const [key, record] of Object.entries(state)) {
    const id = parseId(key);
    const scope: Scope = {
      id,
      k: record.k ?? 0,
      m: record.m,
      s: record.s ?? [],
      i: record.i,
      c: record.c,
      v: record.v,
      x: record.x,
      b: record.b,
      r: root,
    };
    scopes.set(id, scope);
    added.push(scope);
  }
  for (const scope of added) {
    const record = state[scope.id]!;
    if (record.p !== undefined) {
      scope.p = scopes.get(record.p);
      if (scope.p) {
        (scope.p.children ??= new Set()).add(scope);
      }
      treeChanged();
    }
    if (record.o !== undefined) {
      scope.o = scopes.get(record.o);
      if (scope.o) {
        (scope.o.owned ??= new Set()).add(scope);
      }
    }
    if (record.t !== undefined) {
      scope.t = scopes.get(record.t);
    }
    if (record.f !== undefined) {
      scope.f = scopes.get(record.f);
    }
  }
  // The bundles of the roots first, so the components that they hold load with them.
  for (const scope of added) {
    if (scope.m) {
      void options.loadBundle?.(scope.m)?.catch(() => {});
    }
  }
  for (const scope of added) {
    if (scope.m) {
      loadComponent(scope.m);
    }
  }
  const seen = new Set<object>();
  for (const scope of added) {
    // A provided value can hold functions, which a component that reads the context calls.
    for (const key of Object.keys(scope.v ?? {})) {
      scope.v![key] = callable(scope.v![key], seen);
    }
    for (let i = 0; i < scope.s.length; i++) {
      const value = callable(scope.s[i], seen);
      scope.s[i] = value;
      // A promise prop stays a promise, which the stream settles. Nothing handles its rejection.
      if (isPropWrapper(value)) {
        scope.s[i] = value.promise;
        (scope.plain ??= new Set()).add(i);
        value.promise.catch(() => {});
        continue;
      }
      // A value that a later state record settles replaces its promise.
      if (value instanceof Promise) {
        loadingValues.add(value);
        void value.then((result) => {
          settled.set(value, result);
          // A memo that loads again in the browser has a newer load, and the record is old.
          if (scope.s[i] === value && !loads.has(`${scope.id}:${i}`)) {
            set(scope, i, result);
          }
        });
      }
    }
  }
  if (HAS_BINDINGS) {
    // A prop that the server bound with a setter, and that the component wrote an element into.
    for (const scope of added) {
      for (const [slot, bound] of Object.entries(scope.b ?? {})) {
        const value = scope.s[+slot];
        const element =
          value instanceof ElementReference ? findElement(value.scope, value.anchor) : null;
        if (element && !isSlotReference(bound)) {
          send(bound, element);
        }
      }
    }
    // A setter ref in the rest props of a component, by the anchor of the element that spreads them.
    for (const scope of added) {
      for (const [anchor, bound] of Object.entries(state[scope.id]!.r ?? {})) {
        const element = findElement(scope.id, +anchor);
        if (element) {
          give(bound, element);
        }
      }
    }
  }
  hooks.added?.(added);
  return added;
}

/** Stops reading state records and markers that arrive later. Later records wait for `init`. */
export function dispose(): void {
  const queue = stateQueue();
  if (queue.push === pushRecords) {
    // The array's own `push` again, so records wait in it.
    delete (queue as { push?: unknown }).push;
  }
  stopObserving();
}

/**
 * Stops reading, before client navigation replaces only some routes. The
 * server renders the new routes with its current values, so only the writes
 * that come after count for the records that stream in later.
 */
export function leaveRoutes(): void {
  dispose();
  resetWrites();
}

/**
 * Removes the scopes of a render, by its `b-root`, with the scopes inside
 * them. Their cleanups run, and their memos no longer load. Its markup
 * stays. `brumate/testing` calls it when a mounted component unmounts.
 */
export function removeRoot(root: string): void {
  function inside(scope: Scope): boolean {
    for (let current: Scope | undefined = scope; current; current = current.p ?? current.o) {
      if (current.r === root) {
        return true;
      }
    }
    return false;
  }
  // Deleting from a map while iterating it is safe.
  for (const scope of scopes.values()) {
    if (inside(scope)) {
      removeScope(scope);
    }
  }
  refs.delete(root);
  for (const cache of [comments, elements]) {
    for (const [key, node] of cache) {
      if (!node.isConnected) {
        cache.delete(key);
      }
    }
  }
}

/**
 * Forgets the code of components that changed on the dev server, so the next
 * event or update loads the new code. Their state stays. `brumate/hot` calls it.
 */
export function forget(ids: string[]): void {
  for (const id of ids) {
    modules.delete(id);
    loading.delete(id);
    // The new code loads when a scope of the component is read or rendered again.
    pageComponents.delete(id);
  }
}

/** The values of the signals of components whose markup changed, for when the page renders again. */
const remounts = new Map<
  string,
  { after: Record<number, string[]>; values: Record<string, unknown>[] }
>();

/**
 * Keeps the values of the signals of each instance of a component, by
 * name, before the page renders again with its new markup. `brumate/hot` calls it.
 */
export function remount(
  detail: {
    id: string;
    before: Record<number, string[]>;
    after: Record<number, string[]>;
    signals: string[];
  }[],
): void {
  hooks.added = restoreRemounts;
  for (const { id, before, after, signals } of detail) {
    const names = new Set(signals);
    // The signals of the script of the component. Signals of blocks, such as of a `#for`
    // body, start again.
    const kept: Record<string, unknown>[] = [];
    for (const root of scopes.values()) {
      if (root.m === id) {
        const values: Record<string, unknown> = {};
        for (const [slot, name] of (before[root.k] ?? []).entries()) {
          if (names.has(name)) {
            values[name] = root.s[slot];
          }
        }
        kept.push(values);
      }
    }
    remounts.set(id, { after, values: kept });
  }
}

/** Writes back the values of signals that `onRemount` kept, into the instances of the new page. */
function restoreRemounts(added: Scope[]): void {
  for (const [id, { after, values }] of remounts) {
    const instances: Scope[] = [];
    for (const scope of added) {
      if (scope.m === id) {
        instances.push(scope);
      }
    }
    if (instances.length === 0) {
      continue;
    }
    remounts.delete(id);
    for (const [index, root] of instances.entries()) {
      const saved = values[index];
      for (const [slot, name] of (after[root.k] ?? []).entries()) {
        if (saved && name in saved) {
          set(root, slot, saved[name]);
        }
      }
    }
  }
}

/**
 * Forgets the page, before another page replaces it. Cleanups run. Loaded
 * modules and parts stay, so the next page does not load them again. Only
 * client navigation calls it.
 */
export function leavePage(): void {
  dispose();
  for (const scope of scopes.values()) {
    for (const cleanup of scope.cleanups?.values() ?? []) {
      cleanup();
    }
  }
  scopes.clear();
  comments.clear();
  elements.clear();
  unindexed.length = 0;
  rendered.length = 0;
  pendingEffects.clear();
  setHiding(undefined);
  loads.clear();
  loadingSlots.clear();
  for (const memoController of memoControllers.values()) {
    memoController.abort();
  }
  memoControllers.clear();
  renderedLoads.clear();
  for (const { timer } of timers.values()) {
    clearTimeout(timer);
  }
  timers.clear();
  // The next page reuses scope IDs, so a guess left here would match its memos.
  guesses?.map.clear();
  resetIds();
  refs.clear();
  resetWrites();
  leaveGuesses();
  resetHandler();
}

/**
 * Whether the user changed a field since the server rendered it. The server's value is in
 * `defaultValue`, `defaultChecked` and `defaultSelected`. This runs only when the core starts,
 * before any update wrote the field. A value that the browser cleans, such as a number or a
 * range input, can differ from `defaultValue` without the user, and counts as typed.
 */
function typedInto(element: Element): boolean {
  const field = element as HTMLInputElement;
  if (element instanceof HTMLSelectElement) {
    // The last `selected` option wins. Without one, a single select shows its first option that
    // is not disabled, also by a disabled optgroup (`:disabled` knows, `option.disabled` does not), and a list box or a `multiple` select shows none. The test DOM has no
    // `defaultSelected`, so the `selected` attribute is read.
    let expected = -1;
    let first = -1;
    let changed = false;
    for (let i = 0; i < element.options.length; i++) {
      const option = element.options[i]!;
      const rendered = option.hasAttribute('selected');
      if (rendered) {
        expected = i;
      }
      if (first < 0 && !option.matches(':disabled')) {
        first = i;
      }
      changed ||= option.selected !== rendered;
    }
    if (element.multiple) {
      return changed;
    }
    const shown = Number(element.getAttribute('size')) > 1 ? -1 : first;
    return element.selectedIndex !== (expected >= 0 ? expected : shown);
  }
  return isBox(field) ? field.checked !== field.defaultChecked : field.value !== field.defaultValue;
}

/**
 * Writes the signal of each bound field that the user changed before the code loaded, as an
 * `input` event would. The text is in the DOM, and the first update would write the old value
 * back. A field that still has the value the server rendered is not read.
 */
function readFields(): void {
  for (const element of document.querySelectorAll('[b-on*="=$bind#"],[b-on*="=$set:"]')) {
    const custom = hooks.field?.(element);
    if (custom === false || (!custom && !typedInto(element))) {
      continue;
    }
    for (const entry of element.getAttribute('b-on')!.split(' ')) {
      const ref = entry.slice(entry.indexOf('=') + 1);
      if (/^\$(bind#|set:)/.test(ref)) {
        void handle(element, ref, undefined, custom);
      }
    }
  }
}

/** Reads the page state. The loader calls it once, before the first handler. */
export function init(value: CoreOptions): void {
  configure(value);
  if (value.serial) {
    useSerialEntry(value.serial);
  }
  const queue = stateQueue();
  // Records that are still streaming settle their promises when their scripts run. A promise of
  // the page state streams in a later record without any markup that comes later.
  queue.push = pushRecords;
  for (const record of queue.splice(0)) {
    readRecord(record);
  }
  if (HAS_LATE_MARKUP) {
    observeMarkers();
  } else if (document.readyState === 'loading') {
    // The page that the browser reads after an `async` script starts is indexed when it ends.
    document.addEventListener('DOMContentLoaded', () => indexMarkers(document.documentElement), {
      once: true,
    });
  }
  // The whole document, because `#head` content is in the head.
  indexMarkers(document.documentElement);
  if (HAS_FIELDS) {
    readFields();
  }
  watchTitles(document);
  if (DEV) {
    devtools()?.attach?.({ scopes, set, handle });
  }
}
