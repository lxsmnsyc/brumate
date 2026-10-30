// Writes the props of child components that the browser renders.

import { HAS_BINDINGS } from '../features.ts';
import { isBinding } from '../shared.ts';
import { loadModule } from './code.ts';
import { modules, scopes } from './state.ts';
import type { ClientModule, Scope } from './state.ts';
import { get, set, writeSlot } from './updates.ts';

/** Writes a prop of a child component. */
// The keys that the spreads of child components passed last, by the child's scope and anchor.
const spreadKeys = new WeakMap<Scope, Map<number, Set<string>>>();

/**
 * Updates the props of a child component from a spread. A key that the
 * spread passed before and no longer has becomes undefined. `after` names
 * the props after the spread, which win over it.
 */
export function spreadProps(
  scope: Scope,
  anchor: number,
  value: Record<string, unknown> | null | undefined,
  after: string[],
): void {
  const byAnchor = spreadKeys.get(scope) ?? new Map<number, Set<string>>();
  spreadKeys.set(scope, byAnchor);
  const before = byAnchor.get(anchor) ?? new Set();
  // The `b-` names are brumate's own, such as the handlers of a dynamic tag.
  const keys = new Set<string>();
  for (const key of Object.keys(value ?? {})) {
    if (!after.includes(key) && !key.startsWith('b-')) {
      keys.add(key);
    }
  }
  byAnchor.set(anchor, keys);
  for (const key of keys) {
    prop(scope, anchor, key, value![key]);
  }
  for (const key of before) {
    if (!keys.has(key)) {
      prop(scope, anchor, key, undefined);
    }
  }
}

export function prop(scope: Scope, anchor: number, name: string, value: unknown): void {
  // A prop that the parent binds passes its value. The child keeps the slot it writes from its render.
  // A rest prop keeps the binding, for the element that spreads it.
  const bound = value;
  if (HAS_BINDINGS && isBinding(value)) {
    value = value.value;
  }
  const id = scope.c?.[anchor];
  const child = id === undefined ? undefined : scopes.get(id);
  if (!child?.m) {
    return;
  }
  // An arrow, to keep the narrowing of `module` and `value`.
  const apply = (module: ClientModule): void => {
    const slot = module.props[name];
    if (slot !== undefined) {
      // The parent's value. A promise stays a promise: the child awaits it, or loads it with $memo.
      if (value instanceof Promise) {
        (child.plain ??= new Set()).add(slot);
      } else {
        child.plain?.delete(slot);
      }
      // A bound prop does not write it back.
      writeSlot(child, slot, value);
      return;
    }
    const all = module.props['*'];
    if (all !== undefined) {
      set(child, all, { ...(get(child, all) as object), [name]: value });
    }
    // A rest prop, `...rest`, holds the props that the component does not name.
    const rest = module.props['...'];
    if (rest !== undefined) {
      const next: Record<string, unknown> = { ...(get(child, rest) as object) };
      if (value === undefined) {
        delete next[name];
      } else {
        next[name] = bound;
      }
      set(child, rest, next);
    }
  };
  const module = modules.get(child.m);
  if (module) {
    apply(module);
  } else {
    void loadModule(child.m).then(apply);
  }
}
