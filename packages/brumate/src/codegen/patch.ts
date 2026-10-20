import type { SFCFile } from '../ast.ts';
import type { Site } from '../model.ts';
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
      result += this.source.slice(position, edit.start) + edit.text;
      position = edit.end;
    }
    return result + this.source.slice(position, end);
  }
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
 */
export function addValueEdits(
  patch: Patch,
  file: SFCFile,
  sites: Site[],
  mode: 'server' | 'client' = 'server',
): void {
  const sitesByNode = new Map<object, Site>();
  for (const site of sites) {
    sitesByNode.set(site.node, site);
  }
  const visit = (node: oxc.Node): void => {
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
      const name = node.callee.name;
      const argument = node.arguments[0];
      if (name === '$props') {
        patch.replace(node.start, node.end, '$$props');
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
      if (name === '$signal' || name === '$memo' || name === '$untrack') {
        if (!argument) {
          patch.replace(node.start, node.end, 'undefined');
          return;
        }
        const site = name === '$memo' ? sitesByNode.get(argument) : undefined;
        const declaration = site?.declaration;
        if (declaration && mode === 'server') {
          // Any memo can be a promise, so the server holds it as one and awaits it where it is read.
          patch.replace(
            declaration.range.start,
            declaration.range.end,
            promiseName(declaration.name),
          );
        }
        if (site?.awaits) {
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
