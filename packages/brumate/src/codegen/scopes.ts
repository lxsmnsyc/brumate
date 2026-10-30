import type { InsertNode, Markup } from '../ast.ts';
import type { Declaration, Reference, Scope, Site } from '../model.ts';
import { children } from '../oxc.ts';
import type { oxc } from '../oxc.ts';
import { blockBodies } from '../plan.ts';
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

/**
 * Returns the nearest `#loading` or `#defer` body scope that contains a
 * scope, up to `limit`. Both render after the rest of the page, so the
 * page does not wait for the memos that only they read.
 */
export function loadingBody(scope: Scope, limit?: Scope): Scope | undefined {
  for (
    let current: Scope | undefined = scope;
    current && current !== limit;
    current = current.parent
  ) {
    const block = current.block;
    if ((block?.kind === 'loading' || block?.kind === 'defer') && current.body === block.body) {
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
 * The scope whose render waits for a read. A read with `await` inside a
 * `#loading` body makes the render around the block wait, so it counts as
 * a read in the scope that holds the block. Inside a `#defer` body, the
 * request for the body waits, so the read stays where it is. `limit` is
 * the scope of the declaration, which a read inside it never leaves.
 */
function readScope(read: Reference, limit?: Scope): Scope {
  const scope = read.site.scope;
  if (!read.await) {
    return scope;
  }
  const body = loadingBody(scope, limit);
  return body?.block?.kind === 'loading' ? body.parent! : scope;
}

/**
 * Returns the memos that the server awaits where they are declared: those
 * declared with `await $memo(…)`, and those that markup or code outside
 * every `#loading` body reads, with `await` or without. The others are
 * awaited by the `#loading` bodies that read them.
 */
export function blockingMemos(plan: Plan): Set<Declaration> {
  const result = new Set<Declaration>();
  for (const declaration of plan.graph.model.declarations) {
    if (!isMemo(declaration)) {
      continue;
    }
    if (declaration.awaited) {
      result.add(declaration);
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
      if (template || !loadingBody(readScope(read, declaration.scope), declaration.scope)) {
        result.add(declaration);
        break;
      }
    }
  }
  return result;
}

/**
 * Returns the memos that the server waits for where they are declared, but reads where the
 * markup reads them: those without `await`. They hold an error until a read.
 */
export function lazyMemos(blocking: Set<Declaration>, inline: Set<Declaration>): Set<Declaration> {
  const result = new Set<Declaration>();
  for (const declaration of blocking) {
    if (!declaration.awaited && !inline.has(declaration)) {
      result.add(declaration);
    }
  }
  return result;
}

/**
 * Returns the memos that the body of a `#loading` or `#defer` block waits for, which are not
 * plain values. Like `lazyMemos`, they hold their error until a read, so a `#try` inside the
 * body gets it.
 */
export function bodyMemos(
  plan: Plan,
  blocking: Set<Declaration>,
  inline: Set<Declaration>,
): Set<Declaration> {
  const result = new Set<Declaration>();
  for (const scope of plan.bodyScopes.values()) {
    const kind = scope.block?.kind;
    if (kind !== 'loading' && kind !== 'defer') {
      continue;
    }
    for (const declaration of awaitedMemos(plan, scope, blocking)) {
      if (!inline.has(declaration)) {
        result.add(declaration);
      }
    }
  }
  return result;
}

/**
 * Returns the memos that a `#loading` body waits for before it renders:
 * the memos that its markup reads, and the memos that a `#loading` body
 * inside it reads with `await`. Memos that the page or a body around it
 * waits for are left out.
 */
export function awaitedMemos(plan: Plan, body: Scope, blocking: Set<Declaration>): Declaration[] {
  const result = new Set<Declaration>();
  for (const site of plan.graph.model.sites) {
    if (DEFERRED_SITES.has(site.kind)) {
      continue;
    }
    for (const read of site.reads) {
      // Reads that `$isPending` adds for the memos a memo reads have no range, and need no value.
      if (read.range.start === read.range.end || loadingBody(readScope(read)) !== body) {
        continue;
      }
      if (isMemo(read.declaration) && !blocking.has(read.declaration)) {
        result.add(read.declaration);
      }
    }
  }
  const outer = body.parent && loadingBody(body.parent);
  if (outer) {
    for (const declaration of awaitedMemos(plan, outer, blocking)) {
      result.delete(declaration);
    }
  }
  return [...result];
}

/**
 * True if the markup of a `#loading` body may wait for something other than
 * the memos it reads, so the body cannot render in place when those memos
 * are ready: a child component, a dynamic tag, a template, or an insert of
 * a prop, which can be a promise or the children of a parent. Bodies that
 * render later, such as those of a `#loading` or a `#defer` inside it, wait
 * on their own.
 */
export function mayWait(plan: Plan, nodes: Markup[]): boolean {
  const insertWaits = (node: InsertNode): boolean => {
    const site = plan.graph.model.sites.find((item) => item.node === node.expression.ast);
    if (!site) {
      return false;
    }
    for (const read of site.reads) {
      const kind = read.declaration.kind;
      if (kind === 'prop' || kind === 'props-rest' || kind === 'template') {
        return true;
      }
    }
    return false;
  };
  for (const node of nodes) {
    switch (node.kind) {
      case 'component':
      case 'dynamic':
        return true;
      case 'insert':
        if (insertWaits(node)) {
          return true;
        }
        break;
      case 'element':
      case 'fragment':
        if (mayWait(plan, node.children)) {
          return true;
        }
        break;
      case 'text':
      case 'listener':
        break;
      default: {
        let bodies: ReturnType<typeof blockBodies>;
        if (node.kind === 'loading' || node.kind === 'defer' || node.kind === 'client') {
          bodies = node.fallback ? [node.fallback] : [];
        } else {
          bodies = blockBodies(node);
        }
        for (const body of bodies) {
          if (mayWait(plan, body.children)) {
            return true;
          }
        }
      }
    }
  }
  return false;
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

/** True if a name in the code of a site reads a declaration that `plain` accepts. */
export function readsPlain(
  site: Site | undefined,
  name: oxc.Node,
  plain: (declaration: Declaration) => boolean,
): boolean {
  return (
    site?.reads.some(
      (read) =>
        read.range.start === name.start && read.range.end === name.end && plain(read.declaration),
    ) ?? false
  );
}

// Compound assignments that give a primitive whatever the value that they assign.
const ARITHMETIC_ASSIGNMENTS = new Set([
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '**=',
  '<<=',
  '>>=',
  '>>>=',
  '&=',
  '|=',
  '^=',
]);

/** Returns the assignment or update of a site whose target is at `at`. */
function writeAt(node: oxc.Node, at: number): oxc.Node | undefined {
  if (
    (node.type === 'AssignmentExpression' &&
      node.left.type === 'Identifier' &&
      node.left.start === at) ||
    (node.type === 'UpdateExpression' &&
      node.argument.type === 'Identifier' &&
      node.argument.start === at)
  ) {
    return node;
  }
  for (const [, child] of children(node)) {
    const found = writeAt(child, at);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * Returns the memos and signals that always hold a primitive on the server,
 * so the server reads them as plain values.
 *
 * - A memo gives a primitive and calls nothing, so it is never a promise and
 *   needs no render context. Each memo that it reads is one too, so no read
 *   waits for a load. A memo that the server would not compute where it is
 *   declared reads no property, because computing it early must not throw.
 * - A signal starts with a primitive, and each write gives a primitive, such
 *   as `count++`. A signal that an element ref sets is left out.
 */
export function plainValues(plan: Plan, blocking: Set<Declaration>): Set<Declaration> {
  const result = new Set<Declaration>();
  const visiting = new Set<Declaration>();
  const check = (declaration: Declaration): boolean => {
    if (result.has(declaration)) {
      return true;
    }
    if (visiting.has(declaration)) {
      return false;
    }
    visiting.add(declaration);
    const plain =
      declaration.kind === 'signal' ? isPlainSignal(declaration) : isPlainMemo(declaration);
    visiting.delete(declaration);
    if (plain) {
      result.add(declaration);
    }
    return plain;
  };
  const isPlainMemo = (declaration: Declaration): boolean => {
    const site = declaration.site;
    return (
      declaration.kind === 'memo' &&
      !declaration.writable &&
      !declaration.optimistic &&
      site !== undefined &&
      isPrimitive(site.node, (name) => readsPlain(site, name, check)) &&
      isSafe(site.node, blocking.has(declaration)) &&
      site.reads.every((read) => !isMemo(read.declaration) || check(read.declaration))
    );
  };
  const isPlainSignal = (declaration: Declaration): boolean => {
    if (declaration.refs.length > 0) {
      return false;
    }
    const init = declaration.init;
    if (init) {
      const site = plan.graph.model.sites.find((item) => item.node === init);
      if (!isPrimitive(init, (name) => readsPlain(site, name, check))) {
        return false;
      }
    }
    return declaration.writes.every((write) => {
      const node = writeAt(write.site.node, write.range.start);
      if (node?.type === 'UpdateExpression') {
        return true;
      }
      if (node?.type !== 'AssignmentExpression') {
        return false;
      }
      return (
        ARITHMETIC_ASSIGNMENTS.has(node.operator) ||
        isPrimitive(node.right, (name) => readsPlain(write.site, name, check))
      );
    });
  };
  for (const declaration of plan.graph.model.declarations) {
    check(declaration);
  }
  return result;
}
