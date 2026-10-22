// Values that only server function calls and their serialization use. They are
// not in `shared.ts`, which the core imports, so a page's core does not hold them.

import type { FunctionReference } from './shared.ts';

/**
 * Client functions that the server passes on, such as function props, with
 * their references. Kept under a symbol of the registry, so two copies of the
 * runtime, such as a component's and the render context's, share it.
 */
export const functionReferences: WeakMap<object, FunctionReference> = ((
  globalThis as Record<symbol, WeakMap<object, FunctionReference> | undefined>
)[Symbol.for('brumate.functionReferences')] ??= new WeakMap());

/**
 * A file or a blob in the arguments of a server function call. The call
 * sends it as a part of multipart form data, named `file<index>`, instead
 * of in the JSON of the arguments.
 */
export class Upload {
  readonly index: number;

  constructor(index: number) {
    this.index = index;
  }
}

/**
 * Replaces each value in arrays and plain objects that `replace` returns a
 * value for. Returns a copy, or the value itself when nothing changed.
 */
export function replaceDeep(value: unknown, replace: (value: unknown) => unknown): unknown {
  const replaced = replace(value);
  if (replaced !== undefined) {
    return replaced;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceDeep(item, replace));
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceDeep(item, replace)]),
    );
  }
  return value;
}
