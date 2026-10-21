// Values and types that the server and the browser share. It does not import
// seroval, so the core, which reads the page state without it, stays small.
// The plugins that write and read these values are in `serial.ts`.

import { raw } from './html.ts';
import type { Raw } from './html.ts';

/** An element that the server rendered. The client finds it by its anchor. */
export class ElementReference {
  readonly scope: number;
  readonly anchor: number;

  constructor(scope: number, anchor: number) {
    this.scope = scope;
    this.anchor = anchor;
  }
}

/** A client function: an export of a client module, and the scope it reads. */
export class FunctionReference {
  /** `<component id>#<export name>`. */
  readonly ref: string;
  readonly scope: number;

  constructor(ref: string, scope: number) {
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
  e: (scope: number, anchor: number) => ElementReference;
  /** A client function, by its reference and scope. */
  f: (ref: string, scope: number) => FunctionReference;
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
  p?: number;
  /** The component ID of a component's root scope. */
  m?: string;
  /** The item of a list item scope. */
  i?: unknown;
  /** The scope that rendered a component's root scope, for finding contexts. */
  o?: number;
  /** The values that the scope provides, by context key. */
  v?: Record<string, unknown>;
  /** The slots that hold the contexts that the scope reads, by context key. */
  x?: Record<string, number>;
  /** Slot values, in the order of the scope's layout. */
  s?: unknown[];
  /** The scope IDs of child components, by anchor index. */
  c?: Record<number, number>;
}

/** The state of a page, by scope ID. */
export type PageState = Record<number, ScopeState>;

/**
 * The flags of a group of scope records in `PackedState`:
 * - `ITEM_SLOT`: the item of each scope is its first slot.
 * - `ITEM`: each scope has its item after its slots.
 * - `CHILDREN`: each scope has its child components after that.
 * - `OWNER`: the scopes are component root scopes. `base` is the distance from the scope that
 *   rendered each one, `o`, to the scope, and the first gap is from 0. Otherwise `base` is the
 *   parent, `p`, of every scope.
 * - `MODULE`: the group has the component ID of its scopes after its header.
 */
export const ITEM_SLOT = 1;
export const ITEM = 2;
export const CHILDREN = 4;
export const OWNER = 8;
export const MODULE = 16;

/**
 * The page state as the server writes it. Records of scopes that share their
 * kind, their parent or owner, and their shape are in one group of `g`,
 * such as the items of a list, instead of one object each. A group is a flat
 * array: `[kind, base, flags, slotCount, module?, ...scopes]`, and each scope
 * is its ID as the gap from the one before it (the first from `base`), its
 * slots, and then its item and its child components, as `flags` says.
 */
export type PackedState = PageState & { g?: unknown[][] };
