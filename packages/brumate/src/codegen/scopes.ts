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

// Sites that do not run while the server renders.
const DEFERRED_SITES = new Set(['function', 'server-function', 'event', 'effect', 'client']);

/** Returns the nearest `#loading` body scope that contains a scope, up to `limit`. */
export function loadingBody(scope: Scope, limit?: Scope): Scope | undefined {
  for (
    let current: Scope | undefined = scope;
    current && current !== limit;
    current = current.parent
  ) {
    if (current.block?.kind === 'loading' && current.body === current.block.body) {
      return current;
    }
  }
  return undefined;
}

/** Any memo can hold a promise, because its expression can call code that returns one. */
export function isMemo(declaration: Declaration): boolean {
  return declaration.kind === 'memo' || declaration.kind === 'async-memo';
}

/**
 * Returns the memos that the server awaits where they are declared,
 * because markup or code outside every `#loading` body reads them. The
 * others are awaited by the `#loading` bodies that read them.
 */
export function blockingMemos(plan: Plan): Set<Declaration> {
  const result = new Set<Declaration>();
  for (const declaration of plan.graph.model.declarations) {
    if (!isMemo(declaration)) {
      continue;
    }
    for (const read of declaration.reads) {
      const site = read.site;
      if (DEFERRED_SITES.has(site.kind)) {
        continue;
      }
      // Templates can render anywhere, so their reads count as outside.
      let template = false;
      for (let scope: Scope | undefined = site.scope; scope; scope = scope.parent) {
        template ||= scope.kind === 'template';
      }
      if (template || !loadingBody(site.scope, declaration.scope)) {
        result.add(declaration);
        break;
      }
    }
  }
  return result;
}

/** Returns the memos that a `#loading` body awaits before it renders. */
export function awaitedMemos(plan: Plan, body: Scope, blocking: Set<Declaration>): Declaration[] {
  const result = new Set<Declaration>();
  for (const site of plan.graph.model.sites) {
    if (DEFERRED_SITES.has(site.kind) || loadingBody(site.scope) !== body) {
      continue;
    }
    for (const read of site.reads) {
      if (isMemo(read.declaration) && !blocking.has(read.declaration)) {
        result.add(read.declaration);
      }
    }
  }
  return [...result];
}
