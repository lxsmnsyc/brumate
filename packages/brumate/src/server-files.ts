// Files of server functions. A `.ts` or `.js` file whose first statement is
// `'use server'` holds functions that only run on the server. Its exports are
// server functions: the browser gets a stub for each one, which calls the
// server, and the code of the file never ships.

import { parseSync } from 'oxc-parser';

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
function isFunction(node: { type: string } | null | undefined): boolean {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';
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
  return [...functions];
}

/** The module that the browser gets in place of a file of server functions. */
export function serverStubs(source: string, filename: string, id: string): string {
  const lines = [`import { rpc } from ${JSON.stringify(CLIENT)};`];
  for (const name of serverExports(source, filename)) {
    const call = `(...args) => rpc(${JSON.stringify(`${id}#${name}`)}, args)`;
    lines.push(name === 'default' ? `export default ${call};` : `export const ${name} = ${call};`);
  }
  return `${lines.join('\n')}\n`;
}
