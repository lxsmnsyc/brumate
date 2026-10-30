// Every client part imports the names of imported modules that its code uses.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'brumate';
import { parseSync } from 'oxc-parser';
import { expect, it } from 'vitest';

type Node = { type: string; [key: string]: any };

const DIRS = [join(import.meta.dirname, '../src'), join(import.meta.dirname, 'fixtures')];

/** Types and their declarations hold no reads of values. */
const TYPE_NODES = new Set([
  'TSTypeAnnotation',
  'TSTypeParameterDeclaration',
  'TSTypeParameterInstantiation',
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSTypeReference',
  'TSTypeQuery',
]);

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/** The names that a binding pattern declares. */
function patternNames(pattern: Node | null | undefined, names: Set<string>): void {
  if (!pattern) {
    return;
  }
  switch (pattern.type) {
    case 'Identifier':
      names.add(pattern.name);
      break;
    case 'ObjectPattern':
      for (const property of pattern.properties) {
        patternNames(property.type === 'RestElement' ? property.argument : property.value, names);
      }
      break;
    case 'ArrayPattern':
      for (const element of pattern.elements) {
        patternNames(element, names);
      }
      break;
    case 'AssignmentPattern':
      patternNames(pattern.left, names);
      break;
    case 'RestElement':
      patternNames(pattern.argument, names);
      break;
    case 'TSParameterProperty':
      patternNames(pattern.parameter, names);
      break;
  }
}

/** The children of a node, which are nodes. */
function children(node: Node): Node[] {
  const result: Node[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') {
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item && typeof item === 'object' && typeof item.type === 'string') {
        result.push(item);
      }
    }
  }
  return result;
}

/** The names that a scope declares: its declarations, not those of nested functions. */
function declaredIn(node: Node, names: Set<string>, root = true): void {
  if (!root && FUNCTIONS.has(node.type)) {
    if (node.type === 'FunctionDeclaration' && node.id) {
      names.add(node.id.name);
    }
    return;
  }
  if (node.type === 'VariableDeclarator') {
    patternNames(node.id, names);
  } else if (node.type === 'ClassDeclaration' && node.id) {
    names.add(node.id.name);
  } else if (node.type === 'CatchClause') {
    patternNames(node.param, names);
  } else if (node.type === 'ImportDeclaration' && node.importKind !== 'type') {
    for (const specifier of node.specifiers) {
      if (specifier.importKind !== 'type') {
        names.add(specifier.local.name);
      }
    }
  }
  for (const child of children(node)) {
    declaredIn(child, names, false);
  }
}

/** The names that code reads and that no scope around the read declares. */
export function freeNames(code: string): Set<string> {
  const { program, errors } = parseSync('part.ts', code);
  expect(errors).toEqual([]);
  const free = new Set<string>();
  const visit = (node: Node, scopes: Set<string>[]): void => {
    if (TYPE_NODES.has(node.type)) {
      return;
    }
    let inner = scopes;
    if (FUNCTIONS.has(node.type)) {
      const names = new Set<string>();
      for (const param of node.params) {
        patternNames(param, names);
      }
      // A function expression sees its own name.
      if (node.type === 'FunctionExpression' && node.id) {
        names.add(node.id.name);
      }
      if (node.body) {
        declaredIn(node.body, names);
      }
      inner = [...scopes, names];
    } else if (node.type === 'CatchClause' || node.type === 'ClassExpression') {
      const names = new Set<string>();
      patternNames(node.param, names);
      if (node.id) {
        names.add(node.id.name);
      }
      inner = [...scopes, names];
    }
    if (node.type === 'Identifier') {
      if (!inner.some((names) => names.has(node.name))) {
        free.add(node.name);
      }
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent') {
        continue;
      }
      // A name that is not a read: a property, a key, a label, a specifier or a declaration.
      if (
        (node.type === 'MemberExpression' && key === 'property' && !node.computed) ||
        ((node.type === 'Property' || node.type === 'PropertyDefinition') &&
          key === 'key' &&
          !node.computed) ||
        (node.type === 'MethodDefinition' && key === 'key' && !node.computed) ||
        ((node.type === 'LabeledStatement' ||
          node.type === 'BreakStatement' ||
          node.type === 'ContinueStatement') &&
          key === 'label') ||
        node.type === 'ImportDeclaration' ||
        node.type === 'ExportSpecifier' ||
        (node.type === 'VariableDeclarator' && key === 'id') ||
        ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') &&
          key === 'id') ||
        (FUNCTIONS.has(node.type) && key === 'params') ||
        (node.type === 'CatchClause' && key === 'param')
      ) {
        // The defaults and computed keys of a pattern can still read a name.
        if (key === 'id' || key === 'params' || key === 'param') {
          for (const item of Array.isArray(value) ? value : [value]) {
            visitPattern(item, inner);
          }
        }
        continue;
      }
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item && typeof item === 'object' && typeof item.type === 'string') {
          visit(item, inner);
        }
      }
    }
  };
  // The reads inside a binding pattern: defaults and computed keys.
  const visitPattern = (pattern: Node | null | undefined, scopes: Set<string>[]): void => {
    if (!pattern) {
      return;
    }
    if (pattern.type === 'AssignmentPattern') {
      visitPattern(pattern.left, scopes);
      visit(pattern.right, scopes);
    } else if (pattern.type === 'ObjectPattern') {
      for (const property of pattern.properties) {
        if (property.type === 'RestElement') {
          visitPattern(property.argument, scopes);
          continue;
        }
        if (property.computed) {
          visit(property.key, scopes);
        }
        visitPattern(property.value, scopes);
      }
    } else if (pattern.type === 'ArrayPattern') {
      for (const element of pattern.elements) {
        visitPattern(element, scopes);
      }
    } else if (pattern.type === 'RestElement') {
      visitPattern(pattern.argument, scopes);
    }
  };
  const top = new Set<string>();
  declaredIn(program, top);
  visit(program, [top]);
  return free;
}

/** The names that the imports of a source declare, except for types. */
function importedNames(code: string): Set<string> {
  const names = new Set<string>();
  for (const statement of parseSync('source.ts', code).program.body as Node[]) {
    if (statement.type === 'ImportDeclaration' && statement.importKind !== 'type') {
      for (const specifier of statement.specifiers) {
        if (specifier.importKind !== 'type') {
          names.add(specifier.local.name);
        }
      }
    }
  }
  return names;
}

/** The imported names of a component, from its scripts. */
function scriptImports(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    for (const name of importedNames(match[1]!)) {
      names.add(name);
    }
  }
  return names;
}

it('sees a name that a parameter or a binding shadows as declared', () => {
  const code = [
    "import { used } from './x.ts';",
    'export function f(sameKeys, { a: other }) {',
    '  try {} catch (caught) { caught(); }',
    '  return sameKeys(other, used) + (true ? other : 1) + `${other}`;',
    '}',
  ].join('\n');
  expect([...freeNames(code)].filter((name) => name !== 'used')).toEqual([]);
});

it('sees a name that no scope declares', () => {
  const code = "export function f(a) { return a ? sameKeys(a) : `${other}` + 'a//b'; }";
  expect([...freeNames(code)].sort()).toEqual(['other', 'sameKeys']);
});

it('imports in each client part the names that its code uses', () => {
  const files = DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith('.brm'))
      .map((name) => join(dir, name)),
  );
  expect(files.length).toBeGreaterThan(50);
  const problems: string[] = [];
  for (const path of files) {
    const file = path.split('/').pop()!;
    const source = readFileSync(path, 'utf8');
    const { parts, client } = compile(source, { filename: file, path });
    const known = scriptImports(source);
    for (const [part, text] of Object.entries({ ...parts, entry: client })) {
      const free = freeNames(text);
      for (const name of known) {
        if (free.has(name)) {
          problems.push(`${file} part ${part} uses ${name} without importing it`);
        }
      }
    }
  }
  expect(problems).toEqual([]);
});
