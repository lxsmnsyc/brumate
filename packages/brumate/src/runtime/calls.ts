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
 * True for a file or a blob. One from another frame, or another DOM, is an
 * instance of another `Blob` class, so its methods tell instead.
 */
export function isBlob(value: unknown): value is Blob {
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return true;
  }
  const blob = value as Partial<Blob> | null;
  return (
    typeof blob === 'object' &&
    blob !== null &&
    typeof blob.size === 'number' &&
    typeof blob.type === 'string' &&
    typeof blob.arrayBuffer === 'function' &&
    typeof blob.slice === 'function'
  );
}
