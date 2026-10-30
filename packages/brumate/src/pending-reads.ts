import type { Range } from './ast.ts';
import { upstreamMemos } from './model.ts';
import type { Declaration, Site } from './model.ts';
import { children, getPatternNames } from './oxc.ts';
import type { oxc } from './oxc.ts';

/** Reports a read that the compiler rejects, with the message and the place. */
type Report = (message: string, at: Range) => void;

/** The message of a read of `name` that can lack a value. */
export function pendingReadMessage(name: string): string {
  return `The handler reads "${name}", a memo that can lack a value. Wait for it with await $resolve(${name}), or check $isPending(${name}) first`;
}

/** True for a memo that loads: it calls a server function, or awaits. */
function isAsync(declaration: Declaration): boolean {
  return (
    declaration.kind === 'async-memo' ||
    (declaration.site?.reads ?? []).some((read) => read.declaration.serverImport !== undefined)
  );
}

/** The starts of the memo names in `$isPending(…)` and `$resolve(…)` calls of the file. */
let checkedStarts: Set<number> = new Set();

/** The sites that render markup, which the server waits for outside `#loading`. */
const MARKUP_SITES = new Set<Site['kind']>([
  'insert',
  'attribute',
  'tag',
  'spread',
  'style',
  'block',
  'title',
  'prop',
]);

/** True when a scope is inside a `#loading` or `#defer` body, where the server does not wait. */
function inStreamedBody(site: Site): boolean {
  for (let scope: Site['scope'] | undefined = site.scope; scope; scope = scope.parent) {
    if (scope.block?.kind === 'loading' || scope.block?.kind === 'defer') {
      return true;
    }
  }
  return false;
}

/**
 * True when the server waited for the memo, so a page it rendered has the value: markup outside
 * `#loading` reads it, or a memo that is such a read does.
 */
function waitedFor(declaration: Declaration, seen = new Set<Declaration>()): boolean {
  if (seen.has(declaration)) {
    return false;
  }
  seen.add(declaration);
  for (const read of declaration.reads) {
    // `$isPending` and `$resolve` do not read the value, and add reads with no range.
    if (read.range.start === read.range.end || checkedStarts.has(read.range.start)) {
      continue;
    }
    const site = read.site;
    const isHandlerProp =
      site.kind === 'prop' &&
      (site.handlerProp === true ||
        site.node.type === 'ArrowFunctionExpression' ||
        site.node.type === 'FunctionExpression');
    if (MARKUP_SITES.has(site.kind) && !isHandlerProp && !inStreamedBody(site)) {
      return true;
    }
    if (site.kind === 'memo' && site.declaration && waitedFor(site.declaration, seen)) {
      return true;
    }
  }
  return false;
}

/**
 * True for a memo that can lack a value in the browser: it is async, or it reads an async memo, and
 * neither the server waited for it nor `await $memo(…)` declares it.
 */
function lacksValue(declaration: Declaration): boolean {
  if (declaration.awaited || declaration.kind === 'prop') {
    return false;
  }
  const loads = (memo: Declaration): boolean => !memo.awaited && isAsync(memo) && !waitedFor(memo);
  if (declaration.kind === 'async-memo' || declaration.kind === 'memo') {
    return loads(declaration) || upstreamMemos(declaration).some(loads);
  }
  return false;
}

/** The sites whose code runs from an event: handlers, `$client` callbacks and handler props. */
function isRoot(site: Site): boolean {
  return site.kind === 'event' || site.kind === 'client' || site.handlerProp === true;
}

/**
 * Reports each read of a memo that can lack a value in code that runs from an event: a handler,
 * a handler prop of a component, a `$client` callback, and the functions of the same script that
 * they call. A read is fine after `$isPending(memo)` of the memo, or of a memo that reads it.
 */
export function checkPendingReads(
  sites: Site[],
  pendingCalls: { reference: { range: Range; declaration: Declaration } }[],
  report: Report,
): void {
  // `$isPending(name)` calls by the start of their argument.
  const pending = new Map<number, Declaration>();
  for (const { reference } of pendingCalls) {
    pending.set(reference.range.start, reference.declaration);
  }
  checkedStarts = new Set(pending.keys());
  const done = new Set<Site>();
  const reported = new Set<number>();
  const visit = (site: Site): void => {
    if (done.has(site)) {
      return;
    }
    done.add(site);
    for (const read of site.reads) {
      const declaration = read.declaration;
      // The argument of `$isPending`, the reads that it adds for the memos upstream, and the read
      // of its source that a write of `$optimistic` adds (at the source's declaration).
      if (
        read.range.start === read.range.end ||
        read.range.start === declaration.range.start ||
        pending.has(read.range.start) ||
        !lacksValue(declaration) ||
        reported.has(read.range.start)
      ) {
        continue;
      }
      if (!isGuarded(site.node, read.range.start, declaration, pending)) {
        reported.add(read.range.start);
        report(pendingReadMessage(declaration.name), read.range);
      }
    }
    for (const called of site.calls) {
      if (called.kind === 'function' && called.site) {
        visit(called.site);
      }
    }
  };
  for (const site of sites) {
    if (isRoot(site)) {
      visit(site);
    }
  }
}

/** True when `$isPending` of `guard` tells whether `memo` has a value. */
function covers(guard: Declaration, memo: Declaration): boolean {
  return guard === memo || upstreamMemos(guard).includes(memo);
}

/**
 * What a test says about a memo: `pending` when it is true while the memo loads, `ready` when it
 * is true once the memo has a value. `aliases` holds the constants of the blocks around the read,
 * such as `const loading = $isPending(memo)`.
 */
function condition(
  test: oxc.Node,
  memo: Declaration,
  pending: Map<number, Declaration>,
  aliases: Map<string, oxc.Node>,
): 'pending' | 'ready' | undefined {
  switch (test.type) {
    case 'Identifier': {
      const alias = aliases.get(test.name);
      return alias ? condition(alias, memo, pending, new Map()) : undefined;
    }
    case 'CallExpression': {
      const [target] = test.arguments;
      if (test.callee.type === 'Identifier' && test.callee.name === '$isPending' && target) {
        const guard = pending.get(target.start);
        return guard && covers(guard, memo) ? 'pending' : undefined;
      }
      return undefined;
    }
    case 'UnaryExpression': {
      if (test.operator !== '!') {
        return undefined;
      }
      const inner = condition(test.argument, memo, pending, aliases);
      if (inner === 'pending') {
        return 'ready';
      }
      return inner === 'ready' ? 'pending' : undefined;
    }
    case 'LogicalExpression': {
      const left = condition(test.left, memo, pending, aliases);
      const right = condition(test.right, memo, pending, aliases);
      // `a || b` is true when a guard is pending, and `a && b` only when a guard is ready.
      if (test.operator === '||') {
        return left === 'pending' || right === 'pending' ? 'pending' : undefined;
      }
      if (test.operator === '&&') {
        return left === 'ready' || right === 'ready' ? 'ready' : undefined;
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/** True when a statement always leaves the function, the loop or the case around it. */
function exits(statement: oxc.Node): boolean {
  if (
    statement.type === 'ReturnStatement' ||
    statement.type === 'ThrowStatement' ||
    statement.type === 'ContinueStatement' ||
    statement.type === 'BreakStatement'
  ) {
    return true;
  }
  if (statement.type === 'BlockStatement') {
    const last = statement.body.at(-1);
    return last !== undefined && exits(last);
  }
  return false;
}

/** True when the node is `await $resolve(m)` for a memo that covers `memo`. */
function isResolveFor(
  node: oxc.Node,
  memo: Declaration,
  pending: Map<number, Declaration>,
): boolean {
  if (
    node.type === 'AwaitExpression' &&
    node.argument.type === 'CallExpression' &&
    node.argument.callee.type === 'Identifier' &&
    node.argument.callee.name === '$resolve'
  ) {
    const target = node.argument.arguments[0];
    const guard = target && pending.get(target.start);
    return guard !== undefined && covers(guard, memo);
  }
  return false;
}

/**
 * True when a statement of a block always waits with `await $resolve(…)` for a memo that covers
 * `memo`: it is the statement itself, the value of an assignment or a declaration, or read from
 * it. An await inside a condition, a logical expression or a `try` may not run.
 */
function alwaysAwaits(
  node: oxc.Node,
  memo: Declaration,
  pending: Map<number, Declaration>,
): boolean {
  switch (node.type) {
    case 'ExpressionStatement':
      return alwaysAwaits(node.expression, memo, pending);
    case 'VariableDeclaration':
      return node.declarations.some(
        (declarator) => declarator.init && alwaysAwaits(declarator.init, memo, pending),
      );
    case 'AssignmentExpression':
      return alwaysAwaits(node.right, memo, pending);
    case 'MemberExpression':
      return alwaysAwaits(node.object, memo, pending);
    case 'AwaitExpression':
      return isResolveFor(node, memo, pending);
    default:
      return false;
  }
}

/** Finds the chain of nodes from `root` to the identifier that starts at `start`. */
function pathTo(root: oxc.Node, start: number): oxc.Node[] | undefined {
  if (root.start > start || root.end <= start) {
    return undefined;
  }
  if (root.type === 'Identifier' && root.start === start) {
    return [root];
  }
  for (const [, child] of children(root)) {
    const path = pathTo(child, start);
    if (path) {
      return [root, ...path];
    }
  }
  return undefined;
}

/** True when a guard on `memo` comes before the read that starts at `start` in `root`. */
function isGuarded(
  root: oxc.Node,
  start: number,
  memo: Declaration,
  pending: Map<number, Declaration>,
): boolean {
  const path = pathTo(root, start);
  if (!path) {
    return false;
  }
  // The constants of the blocks around the read, such as `const loading = $isPending(memo)`.
  const aliases = new Map<string, oxc.Node>();
  for (let i = 0; i < path.length - 1; i++) {
    const node = path[i]!;
    const child = path[i + 1]!;
    // A parameter of a function that the read is in hides a constant of the same name outside it.
    if (
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'FunctionExpression' ||
      node.type === 'FunctionDeclaration'
    ) {
      for (const param of node.params) {
        for (const name of getPatternNames(param)) {
          aliases.delete(name.name);
        }
      }
    }
    if (node.type === 'BlockStatement' || node.type === 'Program') {
      for (const statement of node.body) {
        if (statement === child) {
          break;
        }
        if (statement.type === 'VariableDeclaration' && statement.kind === 'const') {
          for (const declarator of statement.declarations) {
            if (declarator.id.type === 'Identifier' && declarator.init) {
              aliases.set(declarator.id.name, declarator.init);
            }
          }
        }
      }
      for (const statement of node.body) {
        if (statement === child) {
          break;
        }
        // An earlier `if ($isPending(memo)) return;`, or `await $resolve(memo)`.
        if (
          statement.type === 'IfStatement' &&
          exits(statement.consequent) &&
          condition(statement.test, memo, pending, aliases) === 'pending'
        ) {
          return true;
        }
        if (alwaysAwaits(statement, memo, pending)) {
          return true;
        }
      }
    }
  }
  for (let i = 0; i < path.length - 1; i++) {
    const node = path[i]!;
    const child = path[i + 1]!;
    if (
      (node.type === 'IfStatement' || node.type === 'ConditionalExpression') &&
      child !== node.test
    ) {
      const kind = condition(node.test, memo, pending, aliases);
      if (
        (child === node.consequent && kind === 'ready') ||
        (child === node.alternate && kind === 'pending')
      ) {
        return true;
      }
    } else if (node.type === 'LogicalExpression' && child === node.right) {
      const kind = condition(node.left, memo, pending, aliases);
      if (
        (node.operator === '&&' && kind === 'ready') ||
        (node.operator === '||' && kind === 'pending')
      ) {
        return true;
      }
    }
  }
  return false;
}
