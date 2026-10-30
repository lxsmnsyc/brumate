// The tree of scopes: finding a scope, making one for markup that the client renders, and
// removing one with what it owns.

import { parseId } from '../shared.ts';
import type { ScopeId } from '../shared.ts';
import { MARKER, clear, portals, rangeEnd, rendered, sweepIndexes } from './blocks.ts';
import type { Render } from './branches.ts';
import { loadComponent } from './code.ts';
import {
  comments,
  guesses,
  hiding,
  insertedChildren,
  loadingSlots,
  loads,
  memoControllers,
  scopes,
  waiters,
  timers,
} from './state.ts';
import type { Scope } from './state.ts';

// Scopes that the client creates get negative IDs, so they never match IDs
// from state records that the server streams later.
export let nextId: number = -1;

/** Starts the IDs of the scopes that the client makes again, for a new page. */
export function resetIds(): void {
  nextId = -1;
}

/** Returns the instance of a scope by its ID. */
export function scopeOf(id: ScopeId): Scope | undefined {
  return scopes.get(id);
}

export function rootOf(scope: Scope): Scope {
  let current = scope;
  while (current.p) {
    current = current.p;
  }
  return current;
}

/** Counts changes to the scope tree, so `run` knows when the descendants it found are out of date. */
export let treeChanges: number = 0;

/** Counts a change to the scope tree that `addScopes` makes. */
export function treeChanged(): void {
  treeChanges++;
}

export function descendants(scope: Scope, kind: number, result: Scope[] = []): Scope[] {
  for (const child of scope.children ?? []) {
    if (child.k === kind) {
      result.push(child);
    }
    descendants(child, kind, result);
  }
  return result;
}

export function destroy(scope: Scope): void {
  // A scope that a block already removed, such as one that is both owned and in the range.
  if (scopes.get(scope.id) !== scope) {
    return;
  }
  if (scope.children?.size) {
    for (const child of Array.from(scope.children ?? [])) {
      destroy(child);
    }
  }
  // The components that it rendered have no parent, so they go through their owner.
  if (scope.owned) {
    for (const child of Array.from(scope.owned)) {
      destroy(child);
    }
  }
  // The content of a `#portal` is elsewhere in the page, so it is removed by its markers.
  const start = portals > 0 ? comments.get(`P${scope.id}`) : undefined;
  if (start?.isConnected) {
    const end = rangeEnd(start);
    // The components in it go too, such as children that a component inserted there.
    destroyRange(scope, start, end);
    clear(start, end);
    start.remove();
    end.remove();
  }
  removeScope(scope);
  sweepIndexes();
}

/**
 * Removes a scope from the page: its cleanups run, and its memo state goes,
 * so a load that settles later is not written. Its markup stays.
 */
export function removeScope(scope: Scope): void {
  if (scope.cleanups) {
    for (const cleanup of scope.cleanups.values()) {
      cleanup();
    }
  }
  // The state of the slots that load or wait, which most scopes, such as rows of a list, have not.
  const waiting =
    memoControllers.size + timers.size + loads.size + loadingSlots.size + (guesses?.map.size ?? 0);
  for (let slot = 0; waiting > 0 && slot < scope.s.length; slot++) {
    const key = `${scope.id}:${slot}`;
    memoControllers.get(key)?.abort();
    memoControllers.delete(key);
    clearTimeout(timers.get(key)?.timer);
    timers.delete(key);
    loads.delete(key);
    loadingSlots.delete(key);
    guesses?.map.delete(key);
  }
  if (scope.h) {
    hiding?.bodies.delete(scope.h);
  }
  scopes.delete(scope.id);
  // A `$resolve` of a memo of the scope rejects.
  for (const [check, owner] of waiters) {
    if (owner === scope) {
      check();
    }
  }
  scope.p?.children?.delete(scope);
  scope.o?.owned?.delete(scope);
  treeChanges++;
}

/**
 * Removes the markup of a block of `scope`, between its markers, with the scopes in it: the
 * scopes of its kinds, and the scopes whose markup is in it. Those are the components that the
 * block rendered, whose owner can be `scope` itself, and the children that a component inserted
 * there. A scope that holds `scope` keeps its markers in the block, so it stays.
 */
export function removeBlock(scope: Scope, kinds: number[], start: Node, end: Node): void {
  disposeKinds(scope, kinds);
  destroyRange(scope, start, end);
  clear(start, end);
}

/**
 * Destroys the scopes whose markup is between two nodes, such as the components of a block that
 * closes, but not the scope of the block or those around it.
 */
function destroyRange(scope: Scope, start: Node, end: Node): void {
  if (scopes.size > 0 && start.nextSibling !== end) {
    const above = new Set<Scope>();
    for (let current: Scope | undefined = scope; current; current = current.p ?? current.o) {
      above.add(current);
    }
    const inside = new Set<Scope>();
    const add = (id: string): void => {
      const found = scopes.get(parseId(id));
      if (found && !above.has(found)) {
        inside.add(found);
      }
    };
    for (let node = start.nextSibling; node && node !== end; node = node.nextSibling) {
      const walker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
      );
      for (let current: Node | null = walker.currentNode; current; current = walker.nextNode()) {
        if (current.nodeType === 1) {
          const key = (current as Element).getAttribute('b-b');
          if (key !== null) {
            add(key.slice(0, key.indexOf(':')));
          }
        } else if (MARKER.test((current as Comment).data)) {
          add((current as Comment).data.slice(1).split(':')[0]!);
        }
      }
    }
    for (const found of inside) {
      destroy(found);
    }
  }
}

export function disposeKinds(scope: Scope, kinds: number[]): void {
  for (const child of Array.from(scope.children ?? [])) {
    if (kinds.includes(child.k)) {
      destroy(child);
    }
  }
}

/**
 * The component that holds a block of `scope` in its children, from the kind of the scope that
 * renders the component and the anchor of the component there, which the compiler gives.
 */
function holderOf(scope: Scope, kind?: number, anchor?: number): Scope | undefined {
  if (kind === undefined || anchor === undefined) {
    return undefined;
  }
  for (let current: Scope | undefined = scope; current; current = current.p) {
    if (current.k === kind) {
      const id = current.c?.[anchor];
      const holder = id === undefined ? undefined : scopes.get(id);
      // A component that passes its children on holds them where they are finally inserted.
      return holder?.f ?? holder;
    }
  }
  return undefined;
}

/**
 * A render of a body of a block in the children of a component, which renders as children that
 * the component inserted, so the scopes that it makes read the contexts there, as the scopes
 * that the server made do.
 */
export function inPlace(
  scope: Scope,
  render: Render | undefined,
  kind?: number,
  anchor?: number,
): Render | undefined {
  const holder = render && holderOf(scope, kind, anchor);
  if (!holder) {
    return render;
  }
  return (parent, item, index) => {
    const entry = { from: scope, at: holder };
    insertedChildren.push(entry);
    try {
      return render(parent, item, index);
    } finally {
      insertedChildren.splice(insertedChildren.indexOf(entry), 1);
    }
  };
}

export function resolveScope(scope: Scope | ScopeId | undefined): Scope | undefined {
  if (typeof scope === 'object') {
    return scope;
  }
  return scope === undefined ? undefined : scopes.get(scope);
}

/** Work that waits until rendered markup is in the page. */
export const afterInsert: (() => void)[] = [];

/** The scope that renders the next component, which becomes its owner. */
let owner: Scope | undefined;

// The helpers below are what the server's render context does, for markup that the client
// renders. Each is an export of its own, so a build keeps only those that its components call.

/** Creates a scope for markup that the client renders, and returns its ID. */
export function createScope(
  kind: number,
  parent?: Scope | ScopeId,
  module?: string,
  nodes?: number,
): number {
  const id = nextId--;
  const parentScope = resolveScope(parent);
  const created: Scope = { id, k: kind, p: parentScope, m: module, s: [] };
  // A clone keeps this many nodes on the scope, so the array does not grow.
  if (nodes) {
    // oxlint-disable-next-line unicorn/no-new-array -- A length, with no values written in yet.
    created.n = new Array(nodes);
  }
  rendered.push(created);
  // A component that the browser renders loads its code, as the components of the page do.
  if (module !== undefined) {
    loadComponent(module);
  }
  if (module !== undefined && owner) {
    created.o = owner;
    (owner.owned ??= new Set()).add(created);
    owner = undefined;
  }
  // A scope at the top of children that are inserted elsewhere finds its contexts there.
  const up = created.o ?? parentScope;
  for (let index = insertedChildren.length - 1; index >= 0; index--) {
    if (insertedChildren[index]!.from === up) {
      created.t = insertedChildren[index]!.at;
      break;
    }
  }
  if (parentScope) {
    (parentScope.children ??= new Set()).add(created);
  }
  treeChanges++;
  scopes.set(id, created);
  return id;
}

/**
 * The ID that `$id()` makes, as the server does. Client scope IDs are
 * negative, so they differ from the server's.
 */
export function makeId(scope: Scope | ScopeId, index: number): string {
  return `b${String(resolveScope(scope)!.id).replace(/\./g, '_')}-${index}`;
}

/** Sets the owner of the next component's root scope. */
export function setOwner(scope: Scope | ScopeId): void {
  owner = resolveScope(scope);
}
