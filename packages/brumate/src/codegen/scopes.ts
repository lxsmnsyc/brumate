import type { Declaration, Scope } from '../model.ts';
import type { Plan } from '../plan.ts';

/** Returns the nearest scope, from `scope` outwards, that gets an ID at render time. */
export function instanceScope(plan: Plan, scope: Scope): Scope {
  for (let current: Scope | undefined = scope; current; current = current.parent) {
    if (plan.scopes.get(current)?.needsId) {
      return current;
    }
  }
  return plan.graph.model.component;
}

/**
 * Returns an expression for the instance of `target`, starting from `base`,
 * an expression for the instance of `from`. Instances link to their parent
 * instance with `p`.
 */
export function scopePath(plan: Plan, base: string, from: Scope, target: Scope): string {
  let expression = base;
  let current = instanceScope(plan, from);
  const goal = instanceScope(plan, target);
  while (current !== goal) {
    if (!current.parent || current.kind === 'component') {
      throw new Error(`Scope ${target.id} does not contain scope ${from.id}`);
    }
    expression += '.p';
    current = instanceScope(plan, current.parent);
  }
  return expression;
}

/** Returns the slot index of a declaration, or -1. */
export function slotIndex(plan: Plan, declaration: Declaration): number {
  return plan.scopes.get(declaration.scope)?.slots.indexOf(declaration) ?? -1;
}
