import type { Declaration, Scope, Site } from '../model.ts';
import { children } from '../oxc.ts';
import type { oxc } from '../oxc.ts';

/** Where the load of a statement of awaited memos can start. */
export interface LoadStart {
  /**
   * The index of the last statement before it that declares or changes a
   * value that the memos read, or -1 when there is none.
   */
  after: number;
  /** The awaited memos of other loads that the memos read. Their loads must start first. */
  memos: Declaration[];
}

/**
 * Finds, for each statement of awaited memos (`loads`), the last statement
 * before it that its loads must run after. The memos of a statement read
 * names: those of their expressions, and those that the local functions
 * and memos they call or read read and write, followed through.
 *
 * A statement holds the load when it declares one of those names (or the
 * load would throw a TDZ `ReferenceError`), or can change one: a write such
 * as `q = x`, a call such as `params.set(…)`, an argument of a call, or a
 * mention of a local function that mentions it. A plain read does not hold
 * it. A function declaration does not hold
 * it, since it runs nothing where it is written. `runs` is false for the
 * statements that run nothing where they are written, such as `$effect` on
 * the server, which do not hold it either.
 *
 * An awaited memo of another load is not followed: the load reads it as a
 * memo, so it waits for it on its own. It is listed in `memos`, as its
 * memo must exist before the load starts.
 */
export function findLoadStarts(
  statements: oxc.Node[],
  scope: Scope,
  loads: Map<oxc.Node, Declaration[]>,
  runs: (statement: oxc.Node) => boolean,
): Map<oxc.Node, LoadStart> {
  const awaited = new Set<Declaration>();
  for (const declarations of loads.values()) {
    for (const declaration of declarations) {
      awaited.add(declaration);
    }
  }

  // The names that each statement declares, and those it can change: through a write, a call
  // or an argument, or a local function that it mentions.
  const touched: Set<Declaration>[] = [];
  const declares: Set<Declaration>[] = [];
  const changing = new Set<number>();
  for (const statement of statements) {
    touched.push(new Set());
    declares.push(new Set());
    if (statement.type !== 'FunctionDeclaration') {
      addChanging(changing, statement, false);
    }
  }
  for (let current: Scope | undefined = scope; current; current = current.parent) {
    for (const declaration of current.declarations.values()) {
      const at = findStatement(statements, declaration.range.start);
      if (at !== -1 && statements[at]!.type !== 'FunctionDeclaration') {
        declares[at]!.add(declaration);
      }
      const isFunction = declaration.kind === 'function' || declaration.kind === 'server-function';
      for (const reference of [...declaration.reads, ...declaration.writes]) {
        const index = findStatement(statements, reference.range.start);
        const changes =
          isFunction ||
          changing.has(reference.range.start) ||
          declaration.writes.includes(reference);
        if (index !== -1 && changes) {
          addMentions(touched[index]!, declaration, awaited);
        }
      }
    }
  }

  const result = new Map<oxc.Node, LoadStart>();
  for (const [index, statement] of statements.entries()) {
    const declarations = loads.get(statement);
    if (!declarations) {
      continue;
    }
    // The names that the memos read and write, through functions and other memos.
    const names = new Set<Declaration>();
    const memos: Declaration[] = [];
    for (const declaration of declarations) {
      if (declaration.site) {
        addSiteNames(names, memos, declaration.site, awaited, new Set());
      }
    }
    // The last statement before it that holds it.
    let after = -1;
    for (let before = index - 1; before >= 0; before--) {
      const other = statements[before]!;
      if (
        loads.has(other) ||
        !runs(other) ||
        other.type === 'FunctionDeclaration' ||
        !(overlaps(touched[before]!, names) || overlaps(declares[before]!, names))
      ) {
        continue;
      }
      after = before;
      break;
    }
    result.set(statement, { after, memos });
  }
  return result;
}

const WRAPPERS = new Set([
  'ParenthesizedExpression',
  'ChainExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
]);

/**
 * Adds the positions of the names that code can change: the root of the
 * target of a write, of a callee and of an argument, such as `q` in `q = x`,
 * `params` in `params.set(…)`, and every name in an argument, such as
 * `list` in `fill({ list })`. `root` is true
 * when the node is in such a place.
 */
function addChanging(into: Set<number>, node: oxc.Node, root: boolean): void {
  switch (node.type) {
    case 'Identifier':
      if (root) {
        into.add(node.start);
      }
      return;
    case 'MemberExpression':
      addChanging(into, node.object, root);
      if (node.computed) {
        addChanging(into, node.property, false);
      }
      return;
    case 'AssignmentExpression':
      addChanging(into, node.left, true);
      addChanging(into, node.right, false);
      return;
    case 'UpdateExpression':
      addChanging(into, node.argument, true);
      return;
    case 'UnaryExpression':
      addChanging(into, node.argument, node.operator === 'delete');
      return;
    case 'CallExpression':
    case 'NewExpression':
      addChanging(into, node.callee, true);
      for (const argument of node.arguments) {
        addEvery(into, argument);
      }
      return;
    case 'TaggedTemplateExpression':
      addChanging(into, node.tag, true);
      for (const expression of node.quasi.expressions) {
        addEvery(into, expression);
      }
      return;
    default:
      break;
  }
  // A wrapper and a pattern keep the place of the node. Anything else is read.
  const keep =
    root &&
    (WRAPPERS.has(node.type) ||
      node.type.endsWith('Pattern') ||
      node.type === 'SpreadElement' ||
      node.type === 'Property' ||
      node.type === 'RestElement');
  for (const [key, child] of children(node)) {
    if (node.type === 'Property' && key === 'key' && !node.computed) {
      continue;
    }
    addChanging(into, child, keep);
  }
}

/** Adds the position of every name in an argument, which the callee can change through it. */
function addEvery(into: Set<number>, node: oxc.Node): void {
  if (node.type === 'Identifier') {
    into.add(node.start);
    return;
  }
  for (const [, child] of children(node)) {
    addEvery(into, child);
  }
}

/** The index of the statement that holds a position, or -1. */
function findStatement(statements: oxc.Node[], position: number): number {
  for (const [index, statement] of statements.entries()) {
    if (position >= statement.start && position < statement.end) {
      return index;
    }
  }
  return -1;
}

/** Adds a name that a statement mentions, and the names that a local function it mentions mentions. */
function addMentions(
  into: Set<Declaration>,
  declaration: Declaration,
  awaited: Set<Declaration>,
): void {
  if (into.has(declaration)) {
    return;
  }
  into.add(declaration);
  const site = declaration.site;
  if (site && (declaration.kind === 'function' || declaration.kind === 'server-function')) {
    for (const reference of [...site.reads, ...site.writes]) {
      if (!awaited.has(reference.declaration)) {
        addMentions(into, reference.declaration, awaited);
      }
    }
  }
}

/** Adds the names that a site reads and writes, and those of the functions and memos it reads. */
function addSiteNames(
  names: Set<Declaration>,
  memos: Declaration[],
  site: Site,
  awaited: Set<Declaration>,
  seen: Set<Site>,
): void {
  if (seen.has(site)) {
    return;
  }
  seen.add(site);
  for (const reference of [...site.reads, ...site.writes]) {
    const declaration = reference.declaration;
    if (awaited.has(declaration)) {
      if (declaration.site !== site && !memos.includes(declaration)) {
        memos.push(declaration);
      }
      continue;
    }
    names.add(declaration);
    if (declaration.site && declaration.kind !== 'import') {
      addSiteNames(names, memos, declaration.site, awaited, seen);
    }
  }
}

/** True when two sets share a value. */
function overlaps(left: Set<Declaration>, right: Set<Declaration>): boolean {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }
  return false;
}

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/** True when code waits where it runs: an `await` or a `for await` outside the functions it declares. */
export function hasAwait(node: oxc.Node): boolean {
  if (node.type === 'AwaitExpression' || (node.type === 'ForOfStatement' && node.await)) {
    return true;
  }
  if (FUNCTIONS.has(node.type)) {
    return false;
  }
  for (const [, child] of children(node)) {
    if (hasAwait(child)) {
      return true;
    }
  }
  return false;
}
