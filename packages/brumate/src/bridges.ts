// `bridge()` of `brumate/store`. The page state names a bridge by its module and its export, so
// its value must be a module-level export of a script file. This finds the calls of `bridge` and
// names the bridges that are valid; the compiler reports the rest.

import { parseSync } from 'oxc-parser';
import { BrumateError } from './error.ts';
import { children } from './oxc.ts';
import type { oxc } from './oxc.ts';

const STORE_MODULE = 'brumate/store';
/** The name that `export default bridge(…)` gets, so the module can name it. */
const DEFAULT_LOCAL = '$$default';

/** The message of BRM200. */
export const BRIDGE_EXPORT =
  'The value of bridge() must be a module-level export of a script file or of <script module>, as "export const name = bridge({ … })"';

/** A call of `bridge`, and the name it is exported as when it is valid. */
export interface BridgeCall {
  call: oxc.Node;
  exported?: string;
  /** The name of the binding, which the module writes the name of the bridge for. */
  local?: string;
  /** For `export default bridge(…)`, the statement, which the transform rewrites. */
  statement?: oxc.Node;
}

/** True when a file can hold a call of `bridge`, which is cheap to know before it is parsed. */
export function mayHaveBridge(source: string): boolean {
  return source.includes('bridge') && source.includes(STORE_MODULE);
}

/** The import that the naming calls need. */
export const NAME_BRIDGE_IMPORT: string = `import { nameBridge as $$nameBridge } from ${JSON.stringify(STORE_MODULE)};`;

/**
 * The calls that name the bridges of the `<script module>` of a component, by the ID of the
 * component, `bridge:<id>#<export>`. A bridge that is not an export by name is not in the list;
 * the analyzer reports it.
 */
export function moduleBridgeNames(program: oxc.Program | undefined, componentId: string): string[] {
  const lines: string[] = [];
  for (const { exported, local, statement } of program ? findBridgeCalls(program) : []) {
    if (exported !== undefined && local !== undefined && !statement) {
      lines.push(`$$nameBridge(${local}, ${JSON.stringify(`bridge:${componentId}#${exported}`)});`);
    }
  }
  return lines;
}

/** True when a script file has a bridge that is a module-level export. */
export function hasBridge(source: string, file: string): boolean {
  return scriptBridges(source, file).some((item) => item.exported !== undefined);
}

/** The id of the module of a file, from its name in the app or in its package. */
export function bridgeModuleId(name: string): string {
  return `bridge:${name}`;
}

/** The local names of `bridge` and of namespaces of `brumate/store` that a program imports. */
function importedNames(program: oxc.Program): { direct: Set<string>; spaces: Set<string> } {
  const direct = new Set<string>();
  const spaces = new Set<string>();
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.source.value !== STORE_MODULE) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportNamespaceSpecifier') {
        spaces.add(specifier.local.name);
      } else if (specifier.type === 'ImportSpecifier') {
        const imported =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value;
        if (imported === 'bridge') {
          direct.add(specifier.local.name);
        }
      }
    }
  }
  return { direct, spaces };
}

/** True for a call of the imported `bridge`. */
function isBridgeCall(node: oxc.Node, names: ReturnType<typeof importedNames>): boolean {
  if (node.type !== 'CallExpression') {
    return false;
  }
  const callee = node.callee;
  if (callee.type === 'Identifier') {
    return names.direct.has(callee.name);
  }
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    names.spaces.has(callee.object.name) &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'bridge'
  );
}

/** The expression under `as`, `satisfies`, `!` and parentheses. */
function unwrap(node: oxc.Node): oxc.Node {
  let current = node;
  while (
    current.type === 'TSAsExpression' ||
    current.type === 'TSSatisfiesExpression' ||
    current.type === 'TSNonNullExpression' ||
    current.type === 'ParenthesizedExpression'
  ) {
    current = current.expression;
  }
  return current;
}

/** Every call of `bridge` under a node. */
function collect(node: oxc.Node, names: ReturnType<typeof importedNames>, found: oxc.Node[]): void {
  if (isBridgeCall(node, names)) {
    found.push(node);
  }
  for (const [, child] of children(node)) {
    collect(child, names, found);
  }
}

/**
 * Finds the calls of `bridge` in a program. A call is valid when its value is a `const` that the
 * module exports by name: `export const name = bridge(…)`, or `const name = bridge(…)` with
 * `export { name }` or `export { name as other }`. Every other call has no `exported`.
 */
export function findBridgeCalls(program: oxc.Program): BridgeCall[] {
  const names = importedNames(program);
  if (names.direct.size === 0 && names.spaces.size === 0) {
    return [];
  }
  const calls: oxc.Node[] = [];
  collect(program, names, calls);
  if (calls.length === 0) {
    return [];
  }
  // The bridges that a top-level `const` holds, by the call.
  const locals = new Map<oxc.Node, string>();
  const exported = new Map<oxc.Node, string>();
  const declare = (declaration: oxc.Node, isExport: boolean): void => {
    if (declaration.type !== 'VariableDeclaration' || declaration.kind !== 'const') {
      return;
    }
    for (const declarator of declaration.declarations) {
      const init = declarator.init && unwrap(declarator.init);
      if (init && declarator.id.type === 'Identifier' && isBridgeCall(init, names)) {
        locals.set(init, declarator.id.name);
        if (isExport) {
          exported.set(init, declarator.id.name);
        }
      }
    }
  };
  const defaults = new Map<oxc.Node, oxc.Node>();
  for (const statement of program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      const init = unwrap(statement.declaration as oxc.Node);
      if (isBridgeCall(init, names)) {
        defaults.set(init, statement);
      }
    } else if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
      declare(statement.declaration, true);
    } else {
      declare(statement, false);
    }
  }
  // `export { name }` of a local that holds a bridge.
  for (const statement of program.body) {
    if (
      statement.type === 'ExportNamedDeclaration' &&
      !statement.declaration &&
      !statement.source
    ) {
      for (const specifier of statement.specifiers) {
        for (const [call, local] of locals) {
          if (specifier.local.type === 'Identifier' && specifier.local.name === local) {
            exported.set(
              call,
              specifier.exported.type === 'Identifier'
                ? specifier.exported.name
                : specifier.exported.value,
            );
          }
        }
      }
    }
  }
  const result: BridgeCall[] = [];
  for (const call of calls) {
    const statement = defaults.get(call);
    if (statement) {
      result.push({ call, exported: 'default', local: DEFAULT_LOCAL, statement });
      continue;
    }
    const name = exported.get(call);
    result.push(name === undefined ? { call } : { call, exported: name, local: locals.get(call) });
  }
  return result;
}

/** The calls of `bridge` in a script file, or none when it has none or does not parse. */
export function scriptBridges(source: string, file: string): BridgeCall[] {
  if (!mayHaveBridge(source)) {
    return [];
  }
  const { program, errors } = parseSync(file, source, {
    lang: /\.[cm]?tsx?$/.test(file) ? 'ts' : 'js',
  });
  // Another tool reports a syntax error of a script.
  return errors[0] ? [] : findBridgeCalls(program);
}

/**
 * Checks the bridges of a script file and returns the file with each bridge named, or undefined
 * when it has none. The names are added at the end, so lines stay where they are; only
 * `export default bridge(…)` is rewritten, on its own line, to a `const` and an export. Throws a
 * `BrumateError` (BRM200) for a call that is not a module-level export.
 */
export function nameBridges(source: string, file: string, moduleId: string): string | undefined {
  const lines: string[] = [];
  const edits: [offset: number, remove: number, text: string][] = [];
  for (const { call, exported, local, statement } of scriptBridges(source, file)) {
    if (exported === undefined || local === undefined) {
      throw new BrumateError(BRIDGE_EXPORT, source, call.start, file);
    }
    if (statement) {
      // `export default` becomes `const $$default =`, and the export follows the call.
      edits.push([statement.start, 'export default'.length, `const ${local} =`]);
      edits.push([call.end, 0, `;export default ${local}`]);
    }
    lines.push(`$$nameBridge(${local}, ${JSON.stringify(`${moduleId}#${exported}`)});`);
  }
  if (lines.length === 0) {
    return undefined;
  }
  let code = source;
  // From the end, so the offsets stay right.
  for (const [offset, remove, text] of edits.toSorted((a, b) => b[0] - a[0])) {
    code = code.slice(0, offset) + text + code.slice(offset + remove);
  }
  return `${code}\n${NAME_BRIDGE_IMPORT}\n${lines.join('\n')}\n`;
}
