// Server environment variables stay on the server. The compiler knows which
// code runs in the browser, so it reports a read of a server variable there,
// and a value made from one that the page state would send.

import type { SFCFile } from './ast.ts';
import { initializers } from './captures.ts';
import type { Declaration, Diagnostic, Reference } from './model.ts';
import { children } from './oxc.ts';
import type { oxc } from './oxc.ts';
import type { Plan } from './plan.ts';

/**
 * The names of the server variables that an import gives, such as
 * `import env from './env.ts'`, or undefined for other imports.
 */
export type EnvImport = (specifier: string, name: string) => string[] | undefined;

/** The property that a read of `env` reads, such as `DATABASE_URL` for `env.DATABASE_URL`. */
function propertyAt(node: oxc.Node, at: number): string | undefined | null {
  if (
    node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    node.object.start === at
  ) {
    if (node.computed) {
      return node.property.type === 'Literal' ? String(node.property.value) : null;
    }
    return node.property.type === 'Identifier' ? node.property.name : null;
  }
  for (const [, child] of children(node)) {
    const found = propertyAt(child, at);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/** The server variable that a read reads, or `*` for a read of the whole object. */
function serverRead(read: Reference, server: string[]): string | undefined {
  const nodes = [read.site.node, ...(read.site.extra ?? [])];
  for (const node of nodes) {
    const property = propertyAt(node, read.range.start);
    if (property === undefined) {
      continue;
    }
    if (property === null) {
      return '*';
    }
    return server.includes(property) ? property : undefined;
  }
  return '*';
}

/** Errors for server variables that code in the browser reads, or that the page state would send. */
export function checkEnv(file: SFCFile, plan: Plan, envImport: EnvImport): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const values = initializers(file);
  const slots = new Set<Declaration>();
  for (const layout of plan.scopes.values()) {
    for (const declaration of layout.slots) {
      slots.add(declaration);
    }
  }
  for (const declaration of plan.graph.model.declarations) {
    if (!declaration.imported) {
      continue;
    }
    const server = envImport(declaration.imported.source, declaration.imported.name);
    if (!server) {
      continue;
    }
    const name = declaration.name;
    for (const read of declaration.reads) {
      const variable = serverRead(read, server);
      if (variable === undefined) {
        continue;
      }
      const what =
        variable === '*'
          ? `${name}, with its server variables,`
          : `${name}.${variable}, a server variable,`;
      if (plan.graph.reached.has(read.site)) {
        diagnostics.push({
          severity: 'error',
          message: `${what} is read by code that runs in the browser (${read.site.label}). Read it in a server function`,
          range: read.range,
        });
        continue;
      }
      // A value made from it that client code reads would go to the browser with the page.
      let holder: Declaration | undefined;
      for (const slot of slots) {
        const init = values.get(slot.range.start);
        if (init && read.range.start >= init.start && read.range.end <= init.end) {
          holder = slot;
          break;
        }
      }
      if (holder) {
        diagnostics.push({
          severity: 'error',
          message: `"${holder.name}" holds ${what} and code that runs in the browser reads it. Keep server variables out of values that the browser reads`,
          range: read.range,
        });
      }
    }
  }
  return diagnostics;
}
