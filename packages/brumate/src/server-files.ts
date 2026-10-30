// Files of server functions. A `.ts` or `.js` file whose first statement is
// `'use server'` holds functions that only run on the server. Its exports are
// server functions: the browser gets a stub for each one, which calls the
// server, and the code of the file never ships.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import type { BrumatePackage } from './packages.ts';
import { resolveComponentPackage } from './packages.ts';
import { functionId } from './plan.ts';

/** The import of the stubs, which call server functions with `rpc` of the core. */
const CLIENT = 'brumate/client';

/** True for a file whose first statement is `'use server'`, after comments. */
export function hasUseServer(source: string): boolean {
  return /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*(['"])use server\1/.test(source);
}

/** True for a path that can be a file of server functions. */
export function isScriptFile(path: string): boolean {
  return (
    /\.[cm]?[jt]sx?$/.test(path) && !path.endsWith('.d.ts') && !/\.brm\.[cm]?[jt]s$/.test(path)
  );
}

/** True for a function expression or an arrow. */
type Program = ReturnType<typeof parseSync>['program'];
type Node = Program['body'][number] | { type: string; callee?: unknown } | null | undefined;

/**
 * Tells a value that the file exports as a function: a function expression,
 * or a call of `cached` or `idempotent` of `brumate/server`, which return a function.
 */
function functionTest(program: Program): (node: Node) => boolean {
  const wrappers = new Set<string>();
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration' && statement.source.value === 'brumate/server') {
      for (const specifier of statement.specifiers) {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          (specifier.imported.name === 'cached' || specifier.imported.name === 'idempotent')
        ) {
          wrappers.add(specifier.local.name);
        }
      }
    }
  }
  return (node) => {
    if (node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression') {
      return true;
    }
    const callee =
      node?.type === 'CallExpression'
        ? (node.callee as { type: string; name?: string })
        : undefined;
    return callee?.type === 'Identifier' && wrappers.has(callee.name!);
  };
}

/**
 * The names of the functions that a file of server functions exports.
 * Throws for an export that is not a function, because the browser can only
 * call a server function through its stub.
 */
export function serverExports(source: string, filename: string): string[] {
  const { program, errors } = parseSync(filename, source, { lang: 'ts' });
  if (errors[0]) {
    throw new Error(`${errors[0].message} (${filename})`);
  }
  const functions = new Set<string>();
  const values = new Set<string>();
  const local = new Map<string, 'function' | 'value'>();
  const isFunction = functionTest(program);
  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
      local.set(declaration.id.name, 'function');
    } else if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier') {
          local.set(declarator.id.name, isFunction(declarator.init) ? 'function' : 'value');
        }
      }
    }
  }
  for (const statement of program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      const value = statement.declaration;
      if (value.type === 'FunctionDeclaration' || isFunction(value)) {
        functions.add('default');
      } else {
        values.add('default');
      }
    } else if (statement.type === 'ExportNamedDeclaration') {
      if (statement.exportKind === 'type') {
        continue;
      }
      const declaration = statement.declaration;
      if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
        functions.add(declaration.id.name);
      } else if (declaration?.type === 'VariableDeclaration') {
        for (const declarator of declaration.declarations) {
          if (declarator.id.type === 'Identifier') {
            (isFunction(declarator.init) ? functions : values).add(declarator.id.name);
          }
        }
      } else if (declaration && !declaration.type.startsWith('TS')) {
        values.add('a class');
      }
      for (const specifier of statement.specifiers) {
        if (specifier.exportKind === 'type') {
          continue;
        }
        const name =
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value;
        const from = specifier.local.type === 'Identifier' ? specifier.local.name : '';
        (local.get(from) === 'function' && !statement.source ? functions : values).add(name);
      }
    } else if (statement.type === 'ExportAllDeclaration') {
      values.add('*');
    }
  }
  if (values.size > 0) {
    throw new Error(
      `A 'use server' file exports only functions, because the browser calls them on the server. ${[...values].join(', ')} of ${filename} is not one`,
    );
  }
  // The middleware of the file runs before its functions. The browser cannot call it.
  functions.delete(MIDDLEWARE);
  return [...functions];
}

/** The export of a file of server functions that runs before each of them. */
export const MIDDLEWARE = 'middleware';

/** True if a file of server functions exports `middleware`. */
export function hasServerMiddleware(source: string, filename: string): boolean {
  const { program } = parseSync(filename, source, { lang: 'ts' });
  for (const statement of program.body) {
    if (statement.type !== 'ExportNamedDeclaration' || statement.exportKind === 'type') {
      continue;
    }
    const declaration = statement.declaration;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id?.name === MIDDLEWARE) {
      return true;
    }
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier' && declarator.id.name === MIDDLEWARE) {
          return true;
        }
      }
    }
    for (const specifier of statement.specifiers) {
      const name =
        specifier.exported.type === 'Identifier'
          ? specifier.exported.name
          : specifier.exported.value;
      if (specifier.exportKind !== 'type' && name === MIDDLEWARE) {
        return true;
      }
    }
  }
  return false;
}

/** The module that the browser gets in place of a file of server functions. */
export function serverStubs(
  source: string,
  filename: string,
  id: string,
  hideNames = false,
): string {
  const lines = [`import { rpc } from ${JSON.stringify(CLIENT)};`];
  for (const name of serverExports(source, filename)) {
    const call = `(...args) => rpc(${JSON.stringify(functionId(id, name, hideNames))}, args)`;
    lines.push(name === 'default' ? `export default ${call};` : `export const ${name} = ${call};`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The module that the server runs for a file of server functions: the file,
 * with each exported function wrapped, so its calls while a page renders
 * share a result when their arguments are the same. Offsets stay the same.
 */
export function serverModule(source: string, filename: string, id: string): string {
  const { program } = parseSync(filename, source, { lang: 'ts' });
  const isFunction = functionTest(program);
  // Local names of exported functions, with the name that each is exported as.
  const wrapped = new Map<string, string>();
  const declarations = new Map<string, 'function' | 'const'>();
  let code = source;
  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
      declarations.set(declaration.id.name, 'function');
    } else if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier' && isFunction(declarator.init)) {
          declarations.set(declarator.id.name, 'const');
        }
      }
    }
  }
  function makeLet(declaration: { start: number; kind: string }): void {
    // `const` becomes `let  `, so the function can be wrapped and offsets stay the same.
    if (declaration.kind === 'const') {
      code = `${code.slice(0, declaration.start)}let  ${code.slice(declaration.start + 5)}`;
    }
  }
  for (const statement of program.body) {
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.source ||
      statement.exportKind === 'type'
    ) {
      continue;
    }
    const declaration = statement.declaration;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
      wrapped.set(declaration.id.name, declaration.id.name);
    } else if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier' && isFunction(declarator.init)) {
          wrapped.set(declarator.id.name, declarator.id.name);
          makeLet(declaration);
        }
      }
    }
    for (const specifier of statement.specifiers) {
      const local = specifier.local.type === 'Identifier' ? specifier.local.name : '';
      const exported =
        specifier.exported.type === 'Identifier'
          ? specifier.exported.name
          : specifier.exported.value;
      if (declarations.has(local)) {
        wrapped.set(local, exported);
      }
    }
  }
  // A `const` arrow that `export { name }` exports is declared with `let` too.
  for (const statement of program.body) {
    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        if (declarator.id.type === 'Identifier' && wrapped.has(declarator.id.name)) {
          makeLet(statement);
        }
      }
    }
  }
  if (wrapped.size === 0) {
    return source;
  }
  const lines = ["import { dedupe as __brumateDedupe } from 'brumate/server';"];
  for (const [local, exported] of wrapped) {
    lines.push(`${local} = __brumateDedupe(${local}, ${JSON.stringify(`${id}#${exported}`)});`);
  }
  return `${code}\n${lines.join('\n')}\n`;
}

/**
 * The file of a relative import that holds server functions, such as `./issues` for `issues.ts`
 * with `'use server'` first, or undefined. A package specifier is not looked up.
 */
export function findServerImport(importer: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) {
    return undefined;
  }
  const stem = path.resolve(path.dirname(importer), specifier);
  const candidates = [stem];
  for (const extension of ['.ts', '.tsx', '.js', '.mjs']) {
    candidates.push(stem + extension);
  }
  for (const candidate of candidates) {
    if (
      isScriptFile(candidate) &&
      existsSync(candidate) &&
      hasUseServer(readFileSync(candidate, 'utf8'))
    ) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * The file of server functions that a package of components exports under a
 * bare specifier, or undefined.
 */
export function findPackageServerFile(
  packages: BrumatePackage[],
  importer: string,
  specifier: string,
): string | undefined {
  const file = resolveComponentPackage(packages, specifier, importer);
  return file && isScriptFile(file) && hasUseServer(readFileSync(file, 'utf8')) ? file : undefined;
}
