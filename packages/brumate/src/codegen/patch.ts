import type { SFCFile } from '../ast.ts';
import { copy } from '../sourcemap.ts';
import type { Declaration, Reference, SemanticModel, Site } from '../model.ts';
import { children } from '../oxc.ts';
import type { oxc } from '../oxc.ts';

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
    const edits = this.edits
      .filter((edit) => edit.start >= start && edit.end <= end)
      .toSorted((a, b) => a.start - b.start || a.end - b.end);
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
const MEMOS = new Set(['$memo', '$optimistic', '$debounced', '$throttled']);

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

export function addValueEdits(
  patch: Patch,
  file: SFCFile,
  sites: Site[],
  mode: 'server' | 'client' = 'server',
  inline: Set<Declaration> = new Set(),
  lazy: Set<Declaration> = new Set(),
): void {
  const sitesByNode = new Map<object, Site>();
  // The names that each `$props()` destructures, by the call.
  const propNames = new Map<oxc.Node, string[]>();
  // The `$props()` calls whose pattern has a rest element.
  const restCalls = new Set<oxc.Node>();
  // The names that the other `$props()` calls destructure.
  const otherNames = (call: oxc.Node): string[] => {
    const own = new Set(propNames.get(call));
    return [
      ...new Set(
        [...propNames]
          .filter(([other]) => other !== call)
          .flatMap(([, names]) => names)
          .filter((name) => !own.has(name)),
      ),
    ];
  };
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
        propNames.set(
          init,
          declarator.id.properties.flatMap((property) => {
            const name = property.type === 'Property' ? keyName(property) : undefined;
            return name === undefined ? [] : [name];
          }),
        );
        if (declarator.id.properties.some((property) => property.type === 'RestElement')) {
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
  const readMemos = (
    site: Site,
    node: oxc.Node,
    own?: Declaration,
    only?: Set<Declaration>,
  ): void => {
    // A memo in a shorthand property, such as `{ id }`, keeps its key.
    const shorthands = new Set<number>();
    // `$isPending(memo)` and `$isBound(x)` become `false`, so their arguments are not reads.
    const folded: [number, number][] = [];
    const findShorthands = (current: oxc.Node): void => {
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
    };
    findShorthands(node);
    // The target of a write, such as `shown` in `shown = [...shown, name]`, stays a name.
    const targets = new Set(site.writes.map((write) => write.range.start));
    for (const read of site.reads) {
      if (
        read.range.start !== read.range.end &&
        read.range.start >= node.start &&
        read.range.end <= node.end &&
        !targets.has(read.range.start) &&
        folded.every(([start, end]) => read.range.start < start || read.range.end > end) &&
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
          `${key}$$b.read(${promiseName(read.declaration.name)})`,
        );
        replaced.add(read);
        replacedAt.add(range.start);
      }
    }
  };
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
  const visit = (node: oxc.Node): void => {
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
        let code = '$$b.unbind($$props)';
        if (others.length > 0) {
          code = `$$b.unbind($$props, ${JSON.stringify(names)}, ${JSON.stringify(others)})`;
        } else if (names) {
          code = `$$b.unbind($$props, ${JSON.stringify(names)})`;
        }
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
      if (name === '$isBound') {
        // Nothing writes on the server.
        patch.replace(node.start, node.end, 'false');
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
          patch.replace(
            node.start,
            argument.start,
            site!.awaits ? '$$b.memo(async () => (' : '$$b.memo(() => (',
          );
          // The render context, so server functions that the memo calls read the event of the page,
          // and the name of the memo, for the trace of the devtools.
          patch.replace(argument.end, node.end, `), $$ctx, ${JSON.stringify(declaration.name)})`);
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
  };
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
    const inScript = programs.some(
      (program) => site.node.start >= program.start && site.node.end <= program.end,
    );
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
