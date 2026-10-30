// Every client part imports the names of imported modules that its code uses.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'brumate';
import { expect, it } from 'vitest';

const DIRS = [join(import.meta.dirname, '../src'), join(import.meta.dirname, 'fixtures')];

/** The local names that an `import` statement declares, except for type-only ones. */
function importedNames(code: string): Set<string> {
  const names = new Set<string>();
  for (const match of code.matchAll(
    /^[ \t]*import\s+(?!type\b)([^;]*?)\s+from\s+['"][^'"]+['"];?/gm,
  )) {
    const clause = match[1]!;
    const star = /\*\s+as\s+(\w+)/.exec(clause);
    if (star) {
      names.add(star[1]!);
    }
    const defaultName = /^(\w+)/.exec(clause);
    if (defaultName && !clause.startsWith('{') && !clause.startsWith('*')) {
      names.add(defaultName[1]!);
    }
    const braces = /\{([^}]*)\}/.exec(clause);
    for (const item of braces?.[1]?.split(',') ?? []) {
      const spec = item.trim();
      if (spec && !spec.startsWith('type ')) {
        names.add(
          spec
            .split(/\s+as\s+/)
            .pop()!
            .trim(),
        );
      }
    }
  }
  return names;
}

/** The code without import lines, strings and comments, so only identifiers are left. */
function bodyOf(code: string): string {
  return code
    .replace(/^[ \t]*import[^;]*;$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, '""');
}

it('imports in each client part the names that its code uses', () => {
  const problems: string[] = [];
  const files = DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith('.brm'))
      .map((name) => join(dir, name)),
  );
  expect(files.length).toBeGreaterThan(50);
  for (const path of files) {
    const file = path.split('/').pop()!;
    const source = readFileSync(path, 'utf8');
    const { parts, client } = compile(source, { filename: file, path });
    const known = importedNames(source);
    for (const [part, text] of Object.entries({ ...parts, entry: client })) {
      const have = importedNames(text);
      const body = bodyOf(text);
      for (const name of known) {
        if (have.has(name)) {
          continue;
        }
        // A use is an identifier that is not a property, a key or a declaration.
        const use = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])(?!\\s*:)`, 'g');
        const declared = new RegExp(
          `(?:const|let|var|function|class)\\s+${name.replace(/\$/g, '\\$')}(?![\\w$])`,
        );
        if (use.test(body) && !declared.test(body)) {
          problems.push(`${file} part ${part} uses ${name} without importing it`);
        }
      }
    }
  }
  expect(problems).toEqual([]);
});
