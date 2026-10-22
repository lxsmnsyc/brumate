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
export function addValueEdits(
  patch: Patch,
  file: SFCFile,
  sites: Site[],
  mode: 'server' | 'client' = 'server',
  inline: Set<Declaration> = new Set(),
): void {
  const sitesByNode = new Map<object, Site>();
  // Reads of memos with `await`, by the start of the `await` expression.
  const awaits = new Map<number, Reference>();
  // Reads that the edits of a memo replace, which the visit must leave alone.
  const replaced = new Set<Reference>();
  for (const site of sites) {
    sitesByNode.set(site.node, site);
    for (const read of site.reads) {
      if (read.await) {
        awaits.set(read.await.start, read);
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
        patch.replace(node.start, node.end, '$$props');
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
      if (name === '$signal' || name === '$memo' || name === '$optimistic' || name === '$untrack') {
        if (!argument) {
          patch.replace(node.start, node.end, 'undefined');
          return;
        }
        const site =
          name === '$memo' || name === '$optimistic' ? sitesByNode.get(argument) : undefined;
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
          for (const read of site!.reads) {
            if (
              read.range.start !== read.range.end &&
              read.declaration !== declaration &&
              !inline.has(read.declaration) &&
              (read.declaration.kind === 'memo' || read.declaration.kind === 'async-memo')
            ) {
              // A read with `await` is the read: the value throws when it is still loading.
              const range = read.await ?? read.range;
              patch.replace(
                range.start,
                range.end,
                `$$b.read(${promiseName(read.declaration.name)})`,
              );
              replaced.add(read);
            }
          }
          patch.replace(
            node.start,
            argument.start,
            site!.awaits ? '$$b.memo(async () => (' : '$$b.memo(() => (',
          );
          // The render context, so server functions that the memo calls read the event of the page.
          patch.replace(argument.end, node.end, '), $$ctx)');
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
