// Values and types that the server and the browser share. It does not import
// seroval, so the core, which reads the page state without it, stays small.
// The plugins that write and read these values are in `serial.ts`.

import { raw } from './html.ts';
import type { Raw } from './html.ts';

/**
 * The ID of a scope or of a `#loading` boundary. The rest of the page numbers
 * its scopes from the base of the render, such as `3`. A `#loading` body
 * numbers its own from 0 after the ID of its boundary and a dot, such as
 * `5.0` and `5.1`, so its IDs do not depend on when its data arrives.
 */
export type ScopeId = number | string;

/** Reads a scope or boundary ID from markup. */
export function parseId(text: string): ScopeId {
  return /^-?\d+$/.test(text) ? Number(text) : text;
}

/** Adds a number to an ID. An ID inside a boundary moves with its boundary. */
export function shiftId(id: ScopeId, by: number): ScopeId {
  if (typeof id === 'number') {
    return id + by;
  }
  const dot = id.indexOf('.');
  return `${Number(id.slice(0, dot)) + by}${id.slice(dot)}`;
}

/** An element that the server rendered. The client finds it by its anchor. */
export class ElementReference {
  readonly scope: ScopeId;
  readonly anchor: number;

  constructor(scope: ScopeId, anchor: number) {
    this.scope = scope;
    this.anchor = anchor;
  }
}

/** A client function: an export of a client module, and the scope it reads. */
export class FunctionReference {
  /** `<component id>#<export name>`. */
  readonly ref: string;
  readonly scope: ScopeId;

  constructor(ref: string, scope: ScopeId) {
    this.ref = ref;
    this.scope = scope;
  }
}

/** A component, which the compiler marks with its ID. */
export type ComponentValue = ((...args: never[]) => unknown) & { brumateId: string };

/**
 * Makes the values of brumate's plugins. A state record calls them as `$b`,
 * with one letter each, and the plugins read nodes of server function calls
 * with them too, so both give the same values.
 */
export const stateValues: {
  /** An element that the server rendered, by its scope and anchor. */
  e: (scope: ScopeId, anchor: number) => ElementReference;
  /** A client function, by its reference and scope. */
  f: (ref: string, scope: ScopeId) => FunctionReference;
  /** HTML that the client may insert again. */
  r: (html: string) => Raw;
  /**
   * A component, such as the value of a dynamic tag. The client gets a
   * function with the same ID that renders nothing. The client code that
   * changes the value uses the component's render module instead.
   */
  c: (id: string) => ComponentValue;
} = {
  e: (scope, anchor) => new ElementReference(scope, anchor),
  f: (ref, scope) => new FunctionReference(ref, scope),
  r: raw,
  c: (id) => Object.assign(() => '', { brumateId: id }),
};

/** True for a value that `for await` reads, such as the result of an async generator. */
export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function'
  );
}

/** The state of one scope in the page. */
export interface ScopeState {
  /** The scope's ID in the compiled component. */
  k?: number;
  /** The ID of the scope that contains this one. Component root scopes have none. */
  p?: ScopeId;
  /** The component ID of a component's root scope. */
  m?: string;
  /** The item of a list item scope. */
  i?: unknown;
  /** The scope that rendered a component's root scope, for finding contexts. */
  o?: ScopeId;
  /**
   * For a scope of children that a component inserted, the scope where they
   * are, which contexts are found from in place of `p` and `o`.
   */
  t?: ScopeId;
  /** The values that the scope provides, by context key. */
  v?: Record<string, unknown>;
  /** The slots that hold the contexts that the scope reads, by context key. */
  x?: Record<string, number>;
  /** Slot values, in the order of the scope's layout. */
  s?: unknown[];
  /** The scope IDs of child components, by anchor index. */
  c?: Record<number, ScopeId>;
}

/** The state of a page, by scope ID. */
export type PageState = Record<ScopeId, ScopeState>;

/**
 * The flags of a group of scope records in `PackedState`:
 * - `ITEM_SLOT`: the item of each scope is its first slot.
 * - `ITEM`: each scope has its item after its slots.
 * - `CHILDREN`: each scope has its child components after that.
 * - `OWNER`: the scopes are component root scopes. `base` is the distance from the scope that
 *   rendered each one, `o`, to the scope, and the first gap is from 0. Otherwise `base` is the
 *   parent, `p`, of every scope.
 * - `MODULE`: the group has the component ID of its scopes after its header.
 * - `SOURCE`: the scopes are the items of a list whose list is a slot of an enclosing scope.
 *   The header then has that scope's ID and the slot's index, and the items are not written:
 *   the item of the scope at position `n` in the group is the value at `n` of the list, or of
 *   `Array.from` of a Set. With `ITEM_SLOT`, each scope writes its slots after the first.
 * - `PREFIX`: the scopes are inside a `#loading` body. The header ends with the prefix of
 *   their IDs, such as `5.`, and the gaps count the numbers after it.
 */
export const ITEM_SLOT = 1;
export const ITEM = 2;
export const CHILDREN = 4;
export const OWNER = 8;
export const MODULE = 16;
export const SOURCE = 32;
export const PREFIX = 64;

/**
 * The page state as the server writes it. Records of scopes that share their
 * kind, their parent or owner, and their shape are in one group of `g`,
 * such as the items of a list, instead of one object each. A group is a flat
 * array: `[kind, base, flags, slotCount, module?, source?, sourceSlot?, prefix?, ...scopes]`, and each scope
 * is its ID as the gap from the one before it (the first from `base`), its
 * slots, and then its item and its child components, as `flags` says.
 */
export type PackedState = PageState & { g?: unknown[][] };
