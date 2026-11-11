import type { Markup, SFCFile } from '../ast.ts';
import { copy } from '../sourcemap.ts';
import type { Declaration, Reference, Scope, SemanticModel, Site } from '../model.ts';
import { children } from '../oxc.ts';
import type { oxc } from '../oxc.ts';
import { cannotThrow, neverPromise } from './primitive.ts';

interface Edit {
  start: number;
  end: number;
  text: string;
}

/** Rewrites ranges of the source with edits that do not overlap. */
export class Patch {
  private readonly source: string;
  private readonly edits: Edit[] = [];

  constructor(source: string) {
    this.source = source;
  }

  replace(start: number, end: number, text: string): void {
    this.edits.push({ start, end, text });
  }

  insert(offset: number, text: string): void {
    this.edits.push({ start: offset, end: offset, text });
  }

  slice(start: number, end: number): string {
    // Take the edits inside the range, in source order.
    const inside: Edit[] = [];
    for (const edit of this.edits) {
      if (edit.start >= start && edit.end <= end) {
        inside.push(edit);
      }
    }
    const edits = inside.toSorted((a, b) => a.start - b.start || a.end - b.end);
    let result = '';
    let position = start;
    for (const edit of edits) {
      result += copy(this.source, position, edit.start) + edit.text;
      position = edit.end;
    }
    return result + copy(this.source, position, end);
  }
}

/** The name of the function that a call expression calls, when it is a plain name. */
function calleeName(node: oxc.CallExpression): string | undefined {
  return node.callee.type === 'Identifier' ? node.callee.name : undefined;
}

/** The variable that holds a memo on the server, which can be a promise. */
/** The compile-time functions that declare a memo of their first argument. The others are options. */
const MEMOS = new Set(['$memo', '$gate', '$optimistic', '$debounced', '$throttled']);

/**
 * The code of an arrow function body, given the source offset where the user's expression starts.
 * An expression that starts with `{` is wrapped in parentheses, or the arrow reads it as a block.
 * This covers an object literal under `as`, `satisfies`, `!` and a `<T>` cast, and a sequence or
 * member access that starts with one. The source is checked, not the code, because the code can
 * start with a marker of the compiler.
 */
export function arrowBody(code: string, source: string, start: number): string {
  return source[start] === '{' ? `(${code})` : code;
}

export function promiseName(name: string): string {
  return `$$p_${name}`;
}

/**
 * Adds edits that turn compile-time functions into plain values:
 * `$signal(x)` and `$memo(x)` become `(x)`, `$props()` becomes `$$props`
 * and `$untrack(x)` becomes `(x)`. On the server, a memo is renamed to
 * `$$p_<name>`, because it can hold a promise that is awaited where it is read.
 * The memos in `inline` are plain values on the server too.
 */
/** The name of the key of a property, or undefined for a computed key. */
function keyName(property: oxc.BindingProperty): string | undefined {
  if (property.computed) {
    return undefined;
  }
  if (property.key.type === 'Identifier') {
    return property.key.name;
  }
  return property.key.type === 'Literal' ? String(property.key.value) : undefined;
}

/** The node types that a walk through code that always runs enters. */
const ALWAYS_RUNS = new Set([
  'ExpressionStatement',
  'VariableDeclaration',
  'VariableDeclarator',
  'AssignmentExpression',
  'MemberExpression',
  'CallExpression',
  'NewExpression',
  'BinaryExpression',
  'UnaryExpression',
  'TemplateLiteral',
  'TaggedTemplateExpression',
  'ObjectExpression',
  'Property',
  'ArrayExpression',
  'SpreadElement',
  'ParenthesizedExpression',
  'SequenceExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
]);

/**
 * Adds the start of each name that the code reads whenever it runs. A function, an optional
 * chain, the branch of a condition and the right side of `&&`, `||` and `??` may not run.
 */
function addAlwaysRead(node: oxc.Node, into: Set<number>): void {
  if (node.type === 'Identifier') {
    into.add(node.start);
    return;
  }
  if (node.type === 'ConditionalExpression') {
    addAlwaysRead(node.test, into);
    return;
  }
  if (node.type === 'LogicalExpression') {
    addAlwaysRead(node.left, into);
    return;
  }
  if (
    node.type === 'CallExpression' &&
    (calleeName(node) === '$isPending' || calleeName(node) === '$isBound')
  ) {
    return;
  }
  if (!ALWAYS_RUNS.has(node.type)) {
    return;
  }
  for (const [, child] of children(node)) {
    addAlwaysRead(child, into);
  }
}

/**
 * The expressions of markup that run when the body around them renders: text, and the values of
 * attributes and props. The children of a component and the bodies of blocks render apart.
 */
function addAlwaysMarkup(nodes: Markup[], into: Set<oxc.Node>): void {
  for (const node of nodes) {
    if (node.kind === 'insert') {
      into.add(node.expression.ast);
    } else if (node.kind === 'element' || node.kind === 'dynamic' || node.kind === 'component') {
      for (const attribute of node.attributes) {
        if (attribute.kind === 'value') {
          into.add(attribute.value.ast);
        }
      }
      if (node.kind !== 'component') {
        addAlwaysMarkup(node.children, into);
      }
    } else if (node.kind === 'fragment') {
      addAlwaysMarkup(node.children, into);
    }
  }
}

/** The site kinds whose code does not run when a render runs. */
const NOT_RUN = new Set(['function', 'server-function', 'effect', 'client', 'event']);

/** The site kinds of markup, which run after the script of their scope. */
const MARKUP_SITES = new Set([
  'insert',
  'attribute',
  'prop',
  'spread',
  'tag',
  'block',
  'title',
  'style',
]);

/** The first step of evaluating `node` up to the name at `target` that can throw, if any. */
function throwsBefore(
  node: oxc.Node,
  target: number,
  safe: (name: oxc.Node) => boolean,
): boolean | undefined {
  if (target < node.start || target >= node.end) {
    return undefined;
  }
  if (node.type === 'Identifier') {
    return false;
  }
  const parts: oxc.Node[] = [];
  for (const [, child] of children(node)) {
    // The pattern of a declaration is bound after its value is computed.
    if (node.type === 'VariableDeclarator' && child === node.id) {
      continue;
    }
    parts.push(child);
  }
  parts.sort((a, b) => a.start - b.start);
  for (const part of parts) {
    const found = throwsBefore(part, target, safe);
    if (found !== undefined) {
      return found;
    }
    if (part.end <= target && !cannotThrow(part, safe)) {
      return true;
    }
  }
  return undefined;
}

/** True when the markup holds a component or a dynamic tag, at any depth. */
function hasChildren(value: unknown): boolean {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (hasChildren(item)) {
        return true;
      }
    }
    return false;
  }
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const node = value as { kind?: string };
  if (node.kind === 'component' || node.kind === 'dynamic') {
    return true;
  }
  for (const [key, child] of Object.entries(value)) {
    // The code of an expression is not markup.
    if (key !== 'ast' && key !== 'script' && key !== 'styles' && hasChildren(child)) {
      return true;
    }
  }
  return false;
}

/**
 * The memos that the browser render runs through `renderMemo`, so each holds its error until a
 * read throws it. The others add to `settled`, since they hold none:
 * - a memo that cannot throw, such as `{ show: wanted }`, if it reads no memo that holds an error;
 * - a memo that the render always reads, in code that always runs. It throws at its declaration,
 *   which is the throw of the read to the nearest `#try`, so no read needs a check. A memo of
 *   another memo that always runs counts too. The error must also be the first one: nothing that
 *   can throw runs between the declaration and the first read.
 * A memo with `await` is a promise at once, and a promise holds its error.
 */
function heldMemos(
  file: SFCFile,
  sites: Site[],
  inline: Set<Declaration>,
  settled: Set<Declaration>,
): Set<Declaration> {
  // The memos whose expression can give a promise or throw.
  const candidates = new Set<Declaration>();
  for (const site of sites) {
    if (site.kind === 'memo' && site.declaration && !inline.has(site.declaration)) {
      if (!site.awaits && !neverPromise(site.node as oxc.Node)) {
        candidates.add(site.declaration);
      }
    }
  }
  // The starts of the reads of those memos, which can throw.
  const candidateReads = new Set<number>();
  for (const memo of candidates) {
    for (const read of memo.reads) {
      candidateReads.add(read.range.start);
    }
  }
  // The expressions of markup that run with their body.
  const markup = new Set<oxc.Node>();
  addAlwaysMarkup(file.children, markup);
  const bodies = new Set<unknown>();
  for (const site of sites) {
    const body = site.scope.body;
    if (site.scope.kind === 'body' && body && !bodies.has(body)) {
      bodies.add(body);
      addAlwaysMarkup(body.children, markup);
    }
  }
  // Whether the site runs when the render of its scope runs, and the names it always reads.
  const reached = new Map<Site, Set<number>>();
  function alwaysReads(site: Site): Set<number> {
    let starts = reached.get(site);
    if (!starts) {
      starts = new Set();
      const runs =
        (site.scope.kind === 'component' || site.scope.kind === 'body') &&
        (site.kind === 'memo' ||
          site.kind === 'provide' ||
          (site.kind === 'setup' && (site.label === 'setup' || site.label.startsWith('signal '))) ||
          ((site.kind === 'insert' || site.kind === 'attribute' || site.kind === 'prop') &&
            markup.has(site.node)));
      if (runs) {
        addAlwaysRead(site.node as oxc.Node, starts);
      }
      reached.set(site, starts);
    }
    return starts;
  }
  // The memos that must stay held, since they would throw before another error.
  const blocked = new Set<Declaration>();
  let held = new Set<Declaration>();
  // The memos that the render always reads, with the read that comes first.
  let thrown = new Map<Declaration, Reference>();
  for (;;) {
    held = new Set(candidates);
    thrown = new Map();
    settled.clear();
    settle();
    let again = false;
    for (const [memo, read] of thrown) {
      if (!inOrder(memo, read)) {
        blocked.add(memo);
        again = true;
      }
    }
    if (!again) {
      return held;
    }
  }

  // Whether the declaration of the memo runs its expression once the render reaches it.
  function runsAtOnce(site: Site): boolean {
    const owner = site.declaration;
    return !!owner && !held.has(owner) && !site.awaits;
  }
  // The reads of the memo in code that always runs.
  function alwaysRead(memo: Declaration): Reference[] {
    const result: Reference[] = [];
    for (const read of memo.reads) {
      const site = read.site;
      if (
        site.scope === memo.scope &&
        alwaysReads(site).has(read.range.start) &&
        (site.kind !== 'memo' || runsAtOnce(site))
      ) {
        result.push(read);
      }
    }
    return result;
  }
  // A memo that settles lets the memos around it settle, so repeat until none does.
  function settle(): void {
    let changed = true;
    while (changed) {
      changed = false;
      for (const site of sites) {
        const memo = site.declaration;
        if (site.kind !== 'memo' || !memo || !held.has(memo)) {
          continue;
        }
        let settles = false;
        if (!memo.gate && cannotThrow(site.node as oxc.Node)) {
          // The expression cannot throw, and reads no memo that holds an error.
          settles = true;
          for (const read of site.reads) {
            if (held.has(read.declaration)) {
              settles = false;
            }
          }
        }
        if (!settles && !blocked.has(memo)) {
          const reads = alwaysRead(memo);
          if (reads.length > 0) {
            settles = true;
            thrown.set(memo, reads.toSorted(compareReads)[0]!);
          }
        }
        if (settles) {
          held.delete(memo);
          settled.add(memo);
          changed = true;
        }
      }
    }
  }
  // Markup runs after the script of its scope.
  function phase(site: Site): number {
    return MARKUP_SITES.has(site.kind) ? 1 : 0;
  }
  function compareReads(a: Reference, b: Reference): number {
    return phase(a.site) - phase(b.site) || a.range.start - b.range.start;
  }
  // Whether the code of the site can throw when the render runs it.
  function mayThrow(site: Site, own: Declaration): boolean {
    const owner = site.kind === 'memo' ? site.declaration : undefined;
    if (owner) {
      if (site.awaits || (held.has(owner) && !thrown.has(owner))) {
        return false;
      }
      if (thrown.has(owner)) {
        return true;
      }
    }
    // A name that reads a memo can throw its error, unless the memo is the one being checked.
    const ownReads = new Set<number>();
    let firstOwn = Infinity;
    for (const read of own.reads) {
      ownReads.add(read.range.start);
      if (read.site === site && alwaysReads(site).has(read.range.start)) {
        firstOwn = Math.min(firstOwn, read.range.start);
      }
    }
    const safe = (name: oxc.Node): boolean =>
      ownReads.has(name.start) || !candidateReads.has(name.start);
    // A site that reads the memo first throws the error of the memo, which is the error to show.
    if (firstOwn < Infinity && throwsBefore(site.node as oxc.Node, firstOwn, safe) === false) {
      return false;
    }
    return !cannotThrow(site.node as oxc.Node, safe);
  }
  // Whether the scope is inside `outer`.
  function isInside(scope: Scope | undefined, outer: Scope): boolean {
    for (let at = scope?.parent; at; at = at.parent) {
      if (at === outer) {
        return true;
      }
    }
    return false;
  }
  // Whether nothing that can throw runs between the declaration of the memo, which throws
  // there, and the read that throws first in the program of the base.
  function inOrder(memo: Declaration, read: Reference): boolean {
    const declared = memo.site;
    if (!declared) {
      return false;
    }
    const own = new Set<number>();
    for (const other of memo.reads) {
      own.add(other.range.start);
    }
    // The code before the name in the site of the read.
    if (
      throwsBefore(
        read.site.node as oxc.Node,
        read.range.start,
        (name) => own.has(name.start) || !candidateReads.has(name.start),
      )
    ) {
      return false;
    }
    const atMarkup = phase(read.site) === 1;
    // A child component in the markup renders in place and can throw before the read.
    if (
      atMarkup &&
      hasChildren(memo.scope.kind === 'body' ? memo.scope.body?.children : file.children)
    ) {
      return false;
    }
    for (const site of sites) {
      if (site === declared || site === read.site || NOT_RUN.has(site.kind)) {
        continue;
      }
      let between = false;
      if (site.scope === memo.scope) {
        if (phase(site) === 0) {
          between =
            site.node.start > declared.node.start &&
            (atMarkup || site.node.start < read.range.start);
        } else {
          // The markup of a scope has no order that is known here.
          between = atMarkup;
        }
      } else if (atMarkup && isInside(site.scope, memo.scope)) {
        // The bodies that the markup renders run as it places them.
        between = true;
      }
      if (between && mayThrow(site, memo)) {
        return false;
      }
    }
    return true;
  }
}

export function addValueEdits(
  patch: Patch,
  file: SFCFile,
  sites: Site[],
  mode: 'server' | 'client' | 'render' = 'server',
  inline: Set<Declaration> = new Set(),
  lazy: Set<Declaration> = new Set(),
  component?: number,
): void {
  const sitesByNode = new Map<object, Site>();
  // The names that each `$props()` destructures, by the call.
  const propNames = new Map<oxc.Node, string[]>();
  // The `$props()` calls whose pattern has a rest element.
  const restCalls = new Set<oxc.Node>();
  // The names that the other `$props()` calls destructure.
  function otherNames(call: oxc.Node): string[] {
    const own = new Set(propNames.get(call));
    const result = new Set<string>();
    for (const [other, names] of propNames) {
      if (other === call) {
        continue;
      }
      for (const name of names) {
        if (!own.has(name)) {
          result.add(name);
        }
      }
    }
    return [...result];
  }
  for (const statement of file.instanceScript?.program.body ?? []) {
    if (statement.type !== 'VariableDeclaration') {
      continue;
    }
    for (const declarator of statement.declarations) {
      const init = declarator.init;
      if (
        init?.type === 'CallExpression' &&
        calleeName(init) === '$props' &&
        declarator.id.type === 'ObjectPattern'
      ) {
        const names: string[] = [];
        let hasRest = false;
        for (const property of declarator.id.properties) {
          const name = property.type === 'Property' ? keyName(property) : undefined;
          if (name !== undefined) {
            names.push(name);
          }
          if (property.type === 'RestElement') {
            hasRest = true;
          }
        }
        propNames.set(init, names);
        if (hasRest) {
          restCalls.add(init);
        }
      }
    }
  }
  // Reads of memos with `await`, by the start of the `await` expression.
  const awaits = new Map<number, Reference>();
  // Reads that the edits of a memo replace, which the visit must leave alone.
  const replaced = new Set<Reference>();
  // The same reads by position, since a site can hold the node of another site.
  const replacedAt = new Set<number>();
  for (const site of sites) {
    sitesByNode.set(site.node, site);
    for (const read of site.reads) {
      if (read.await) {
        awaits.set(read.await.start, read);
      }
    }
  }
  // Reads of other memos become reads of the memos, so a value that is still loading throws.
  function readMemos(site: Site, node: oxc.Node, own?: Declaration, only?: Set<Declaration>): void {
    // A memo in a shorthand property, such as `{ id }`, keeps its key.
    const shorthands = new Set<number>();
    // `$isPending(memo)` and `$isBound(x)` become `false`, so their arguments are not reads.
    const folded: [number, number][] = [];
    function findShorthands(current: oxc.Node): void {
      if (
        current.type === 'CallExpression' &&
        (calleeName(current) === '$isPending' || calleeName(current) === '$isBound')
      ) {
        folded.push([current.start, current.end]);
      }
      if (current.type === 'Property' && current.shorthand) {
        shorthands.add(current.value.start);
      }
      for (const [, child] of children(current)) {
        findShorthands(child);
      }
    }
    findShorthands(node);
    // Whether a read sits inside one of the folded calls.
    function isFolded(read: Reference): boolean {
      for (const [start, end] of folded) {
        if (read.range.start >= start && read.range.end <= end) {
          return true;
        }
      }
      return false;
    }
    // The target of a write, such as `shown` in `shown = [...shown, name]`, stays a name.
    const targets = new Set<number>();
    for (const write of site.writes) {
      targets.add(write.range.start);
    }
    for (const read of site.reads) {
      if (
        read.range.start !== read.range.end &&
        read.range.start >= node.start &&
        read.range.end <= node.end &&
        !targets.has(read.range.start) &&
        !isFolded(read) &&
        read.declaration !== own &&
        !inline.has(read.declaration) &&
        (!only || only.has(read.declaration)) &&
        !replaced.has(read) &&
        !replacedAt.has((read.await ?? read.range).start) &&
        (read.declaration.kind === 'memo' || read.declaration.kind === 'async-memo')
      ) {
        // A read with `await` is the read: the value throws when it is still loading.
        const range = read.await ?? read.range;
        const key = shorthands.has(range.start) ? `${read.declaration.name}: ` : '';
        patch.replace(
          range.start,
          range.end,
          mode === 'render'
            ? `${key}$$b.readMemo(${read.declaration.name})`
            : `${key}$$b.read(${promiseName(read.declaration.name)})`,
        );
        replaced.add(read);
        replacedAt.add(range.start);
      }
    }
  }
  // The memos that hold no error in a render: the declaration of one gives its value or throws.
  const settled = new Set<Declaration>();
  if (mode === 'render') {
    const held = heldMemos(file, sites, inline, settled);
    // A read of a memo that holds an error throws the error, as the server's does.
    for (const site of sites) {
      readMemos(site, site.node as oxc.Node, site.declaration, held);
    }
  }
  if (mode === 'server') {
    // A function can run while the server renders, such as one that the markup calls. The render
    // waits only for the memos that the markup reads, so the function reads its memos itself.
    for (const site of sites) {
      if (site.kind === 'function') {
        readMemos(site, site.node as oxc.Node);
      }
    }
    // A memo that the render waits for without `await` holds its error until a read, so the
    // markup reads it in place, and the `#try` around the read gets the error.
    if (lazy.size > 0) {
      for (const site of sites) {
        if (site.kind !== 'function' && site.kind !== 'memo') {
          readMemos(site, site.node as oxc.Node, undefined, lazy);
        }
      }
    }
  }
  function visit(node: oxc.Node): void {
    if (node.type === 'AwaitExpression') {
      const argument = node.argument;
      if (argument.type === 'CallExpression' && calleeName(argument) === '$memo') {
        // `await $memo(x)` waits where the memo is declared. The wait is in the render around.
        patch.replace(node.start, argument.start, '');
        visit(argument);
        return;
      }
      const read = awaits.get(node.start);
      if (read && !replaced.has(read)) {
        // `await name` of a memo is a read of its value, which the render around it waited for.
        patch.replace(node.start, node.end, read.declaration.name);
        return;
      }
    }
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
      const name = node.callee.name;
      const argument = node.arguments[0];
      if (name === '$props') {
        // The props that the component destructures by name get the values of their bindings, and
        // a rest prop keeps them, so a spread passes them on. See `unbind`.
        const names = propNames.get(node);
        // A rest prop leaves out the props that another `$props()` call names.
        const others = names && restCalls.has(node) ? otherNames(node) : [];
        // The scope of the component collects the promise props, so the page state can tell them
        // from the memos that stream. It is passed here since the call can follow an `await`.
        const sink =
          component === undefined
            ? ''
            : `${mode === 'server' ? '$$ctx' : '$$b'}.sink($$s${component})`;
        // Arguments the call leaves out are `undefined` when a later one follows.
        const list = ['$$props', names ? JSON.stringify(names) : 'undefined'];
        list.push(others.length > 0 ? JSON.stringify(others) : 'undefined');
        list.push(sink || 'undefined');
        while (list.at(-1) === 'undefined') {
          list.pop();
        }
        const code = `$$b.unbind(${list.join(', ')})`;
        patch.replace(node.start, node.end, code);
        return;
      }
      if (name === '$action') {
        // The server reads the result of a form post to this page. The client gets it from the state.
        patch.replace(
          node.start,
          node.end,
          mode === 'server' && argument?.type === 'Identifier'
            ? `$$b.actionResult($$ctx, ${argument.name})`
            : 'undefined',
        );
        return;
      }
      if (name === '$searchParam' && argument) {
        // The server reads the URL of the request, and the browser reads `location`.
        patch.replace(
          node.start,
          argument.start,
          mode === 'server' ? '$$b.searchParam($$ctx, ' : '$$b.searchParam(',
        );
        for (const rest of node.arguments) {
          visit(rest);
        }
        return;
      }
      if (name === '$isBound') {
        // Nothing writes on the server.
        patch.replace(node.start, node.end, 'false');
        return;
      }
      if (name === '$resolve' && argument) {
        // The server has the value, or waits for it where it reads it.
        patch.replace(node.start, argument.start, 'Promise.resolve(');
        patch.replace(argument.end, node.end, ')');
        visit(argument);
        return;
      }
      if (name === '$isPending') {
        // Nothing loads again on the server.
        patch.replace(node.start, node.end, 'false');
        return;
      }
      if (name === '$produce' && argument?.type === 'Identifier') {
        // `$produce(todos, recipe)` becomes `(todos = $$b.produce(todos, recipe))`.
        patch.replace(node.start, argument.start, `(${argument.name} = $$b.produce(`);
        patch.insert(node.end, ')');
        for (const rest of node.arguments.slice(1)) {
          visit(rest);
        }
        return;
      }
      if (MEMOS.has(name!) || name === '$signal' || name === '$untrack') {
        if (!argument) {
          patch.replace(node.start, node.end, 'undefined');
          return;
        }
        const site = MEMOS.has(name!) ? sitesByNode.get(argument) : undefined;
        const declaration =
          site?.declaration && !inline.has(site.declaration) ? site.declaration : undefined;
        if (declaration && mode === 'server') {
          // Any memo can be a promise, so the server holds it as one and awaits it where it is read.
          patch.replace(
            declaration.range.start,
            declaration.range.end,
            promiseName(declaration.name),
          );
        }
        if (declaration && mode === 'server') {
          // The server computes a memo when it is read. Memos that it reads are read as memos,
          // so a value that is still loading stops it until the load settles.
          readMemos(site!, argument, declaration);
          let open = site!.awaits ? '$$b.memo(async () => (' : '$$b.memo(() => (';
          if (declaration.gate) {
            // A promise is an error here, held until a read.
            open = '$$b.memo(() => $$b.gateValue(';
          }
          patch.replace(node.start, argument.start, open);
          // The render context, so server functions that the memo calls read the event of the page,
          // and the name of the memo, for the trace of the devtools.
          patch.replace(argument.end, node.end, `), $$ctx, ${JSON.stringify(declaration.name)})`);
        } else if (mode === 'render' && declaration?.gate) {
          // A promise is an error here. It is held until a read, or thrown at once.
          const open = settled.has(declaration)
            ? '$$b.gateValue('
            : '$$b.renderMemo(() => $$b.gateValue(';
          patch.replace(node.start, argument.start, open);
          patch.replace(argument.end, node.end, settled.has(declaration) ? ')' : '))');
        } else if (mode === 'render' && declaration && (site!.awaits || !neverPromise(argument))) {
          // The render marks a promise, so `setSlots` starts the load. A throw is held as a
          // value, unless the memo cannot throw, or throws at once.
          let open = site!.awaits ? '$$b.renderMemo(async () => (' : '$$b.renderMemo(() => (';
          if (settled.has(declaration)) {
            open = '$$b.memoNow(';
          }
          patch.replace(node.start, argument.start, open);
          patch.replace(argument.end, node.end, settled.has(declaration) ? ')' : '))');
        } else if (site?.awaits) {
          // `await` needs an async function, and then it does not hold up the code after it.
          patch.replace(node.start, argument.start, '(async () => (');
          patch.replace(argument.end, node.end, '))()');
        } else {
          patch.replace(node.start, argument.start, '(');
          patch.replace(argument.end, node.end, ')');
        }
        visit(argument);
        return;
      }
    }
    for (const [, child] of children(node)) {
      visit(child);
    }
  }
  const programs: oxc.Program[] = [];
  if (file.instanceScript) {
    programs.push(file.instanceScript.program);
  }
  for (const site of sites) {
    const body = site.scope.body;
    if (body?.script && !programs.includes(body.script.program)) {
      programs.push(body.script.program);
    }
  }
  for (const program of programs) {
    visit(program);
  }
  for (const site of sites) {
    let inScript = false;
    for (const program of programs) {
      if (site.node.start >= program.start && site.node.end <= program.end) {
        inScript = true;
        break;
      }
    }
    if (!inScript) {
      visit(site.node);
    }
  }
}

/** Applies JSX whitespace rules: lines are trimmed and whitespace-only lines are dropped. */
export function cleanText(value: string): string {
  if (!value.includes('\n')) {
    return value;
  }
  const lines = value.split('\n');
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!.replace(/\t/g, ' ');
    if (i > 0) {
      line = line.trimStart();
    }
    if (i < lines.length - 1) {
      line = line.trimEnd();
    }
    if (line) {
      result.push(line);
    }
  }
  return result.join(' ');
}

/**
 * Turns `getEvent()` from `brumate/server` in the code of a component into
 * `$$ctx.getEvent()`, which reads the event of the render. The render awaits
 * memos in the middle of the code, so the event that the runtime sets for
 * the first part of a call would be gone. Server functions and the module
 * script keep `getEvent()`, which the runtime gives the event of their call.
 */
export function addEventEdits(patch: Patch, model: SemanticModel): void {
  for (const declaration of model.declarations) {
    if (
      declaration.kind !== 'import' ||
      declaration.imported?.source !== 'brumate/server' ||
      declaration.imported.name !== 'getEvent'
    ) {
      continue;
    }
    for (const read of declaration.reads) {
      if (read.site.kind !== 'server-function' && read.site.scope.kind !== 'module') {
        patch.replace(read.range.start, read.range.end, '$$ctx.getEvent');
      }
    }
  }
}
