// Compile-time functions, such as `$signal`, come from `brumate/signals`.
// This pass reads those imports, gives renamed imports their own names
// back, and finds calls that are not imported.

import type { Range, SFCFile } from './ast.ts';
import type { Diagnostic } from './model.ts';
import type { oxc } from './oxc.ts';

/** The module of the compile-time functions. */
export const SIGNALS_MODULE = 'brumate/signals';

/** The compile-time functions that `brumate/signals` exports. */
export const MACROS: Set<string> = new Set([
  '$props',
  '$signal',
  '$memo',
  '$optimistic',
  '$debounced',
  '$throttled',
  '$effect',
  '$client',
  '$untrack',
  '$produce',
  '$isPending',
  '$isBound',
  '$isPassed',
  '$setContext',
  '$getContext',
  '$route',
  '$navigation',
  '$id',
  '$title',
  '$action',
  '$handler',
  '$bind',
]);

/** Compile-time functions that have a new name, by old name. */
export const RENAMED_MACROS: ReadonlyMap<string, string> = new Map([
  ['$provide', '$setContext'],
  ['$context', '$getContext'],
]);

/** True for `import … from 'brumate/signals'`, which the compiler removes. */
export function isMacroImport(statement: oxc.Node): boolean {
  return statement.type === 'ImportDeclaration' && statement.source.value === SIGNALS_MODULE;
}

/** Calls every AST node inside a value of the file, such as a script or an expression. */
export function walk(
  value: unknown,
  visit: (node: oxc.Node) => void,
  seen: Set<object> = new Set(),
): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, visit, seen);
    }
    return;
  }
  if (typeof (value as { type?: unknown }).type === 'string') {
    visit(value as oxc.Node);
  }
  for (const [key, child] of Object.entries(value)) {
    // `source` is the text of the file, and ranges hold numbers only.
    if (key !== 'source') {
      walk(child, visit, seen);
    }
  }
}

/**
 * Reads the imports of `brumate/signals` in the file. A call of a renamed
 * import, such as `signal(0)` after `import { $signal as signal }`, gets the
 * name of the compile-time function, so the compiler sees `$signal(0)`.
 * Returns the compile-time functions that the file imports, and errors for
 * imports of compile-time functions that have a new name.
 */
export function resolveMacros(file: SFCFile): {
  imported: Set<string>;
  diagnostics: Diagnostic[];
} {
  const aliases = new Map<string, string>();
  const diagnostics: Diagnostic[] = [];
  walk(file, (node) => {
    if (!isMacroImport(node)) {
      return;
    }
    for (const specifier of (node as oxc.ImportDeclaration).specifiers) {
      if (specifier.type === 'ImportSpecifier') {
        const imported =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value;
        aliases.set(specifier.local.name, imported);
        const renamed = RENAMED_MACROS.get(imported);
        if (renamed) {
          diagnostics.push({
            severity: 'error',
            message: `${imported} was renamed to ${renamed}. Import ${renamed} from '${SIGNALS_MODULE}'`,
            range: { start: specifier.start, end: specifier.end },
          });
        }
      }
    }
  });
  if ([...aliases].some(([local, imported]) => local !== imported)) {
    walk(file, (node) => {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
        const imported = aliases.get(node.callee.name);
        if (imported) {
          node.callee.name = imported;
        }
      }
    });
  }
  return { imported: new Set(aliases.values()), diagnostics };
}

/** Reports calls of compile-time functions that the file does not import. */
export function checkMacroImports(file: SFCFile, imported: Set<string>): Diagnostic[] {
  const missing = new Map<string, Range>();
  walk(file, (node) => {
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      (MACROS.has(node.callee.name) || RENAMED_MACROS.has(node.callee.name)) &&
      !imported.has(node.callee.name) &&
      !missing.has(node.callee.name)
    ) {
      missing.set(node.callee.name, { start: node.start, end: node.end });
    }
  });
  return [...missing].map(([name, range]) => {
    const renamed = RENAMED_MACROS.get(name);
    return {
      severity: 'error',
      message: renamed
        ? `${name} was renamed to ${renamed}. Import ${renamed} from '${SIGNALS_MODULE}'`
        : `Import ${name} from '${SIGNALS_MODULE}'`,
      range,
    };
  });
}
