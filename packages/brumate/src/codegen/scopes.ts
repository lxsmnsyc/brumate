import type { Declaration, Scope, Site } from '../model.ts';
import { children } from '../oxc.ts';
import type { oxc } from '../oxc.ts';
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
      if (read.range.start === read.range.end) {
        continue;
      }
      const site = read.site;
      // A memo reads another memo when it computes, so it does not need the value where it is declared.
      if (DEFERRED_SITES.has(site.kind) || site.kind === 'memo') {
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
      // Reads that `$isPending` adds for the memos a memo reads have no range, and need no value.
      if (read.range.start === read.range.end) {
        continue;
      }
      if (isMemo(read.declaration) && !blocking.has(read.declaration)) {
        result.add(read.declaration);
      }
    }
  }
  return [...result];
}

/** Expressions that run code the compiler cannot see, or that a memo should not hold. */
const UNSAFE_NODES = new Set([
  'CallExpression',
  'NewExpression',
  'TaggedTemplateExpression',
  'AwaitExpression',
  'YieldExpression',
  'ImportExpression',
  'AssignmentExpression',
  'UpdateExpression',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ClassExpression',
]);

/**
 * True if an expression always gives a primitive, so it is never a promise
 * or an async iterable. A name is a primitive when `plain` says that it reads
 * a declaration that holds one.
 */
export function isPrimitive(
  node: oxc.Node,
  plain: (name: oxc.Node) => boolean = () => false,
): boolean {
  switch (node.type) {
    case 'Identifier':
      return plain(node);
    case 'Literal':
      return !('regex' in node && node.regex);
    case 'TemplateLiteral':
    case 'BinaryExpression':
    case 'UnaryExpression':
      return true;
    case 'LogicalExpression':
      return isPrimitive(node.left, plain) && isPrimitive(node.right, plain);
    case 'ConditionalExpression':
      return isPrimitive(node.consequent, plain) && isPrimitive(node.alternate, plain);
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      return isPrimitive(node.expression, plain);
    default:
      return false;
  }
}

/** True if an expression calls no code and, unless `members`, reads no property. */
function isSafe(node: oxc.Node, members: boolean): boolean {
  if (UNSAFE_NODES.has(node.type)) {
    return false;
  }
  if (!members && (node.type === 'MemberExpression' || node.type === 'ChainExpression')) {
    return false;
  }
  for (const [, child] of children(node)) {
    if (!isSafe(child, members)) {
      return false;
    }
  }
  return true;
}

/** True if a name in the code of a site reads a memo that the server computes as a plain value. */
export function readsInline(
  site: Site | undefined,
  name: oxc.Node,
  inline: (declaration: Declaration) => boolean,
): boolean {
  return (
    site?.reads.some(
      (read) =>
        read.range.start === name.start &&
        read.range.end === name.end &&
        inline(read.declaration),
    ) ?? false
  );
}

/**
 * Returns the memos that the server computes as plain values where they are
 * declared. Such a memo gives a primitive and calls nothing, so it is never a
 * promise and needs no render context. Each memo that it reads is one too, so
 * no read waits for a load. A memo that the server would not compute where it
 * is declared reads no property, because computing it early must not throw.
 */
export function inlineMemos(plan: Plan, blocking: Set<Declaration>): Set<Declaration> {
  const result = new Set<Declaration>();
  const visiting = new Set<Declaration>();
  const check = (declaration: Declaration): boolean => {
    if (result.has(declaration)) {
      return true;
    }
    const site = declaration.site;
    if (
      declaration.kind !== 'memo' ||
      declaration.writable ||
      declaration.optimistic ||
      !site ||
      visiting.has(declaration)
    ) {
      return false;
    }
    visiting.add(declaration);
    const inline =
      isPrimitive(site.node, (name) => readsInline(site, name, check)) &&
      isSafe(site.node, blocking.has(declaration)) &&
      site.reads.every((read) => !isMemo(read.declaration) || check(read.declaration));
    visiting.delete(declaration);
    if (inline) {
      result.add(declaration);
    }
    return inline;
  };
  for (const declaration of plan.graph.model.declarations) {
    check(declaration);
  }
  return result;
}
