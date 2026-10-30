// Values that code in the browser reads go to the browser with the page.
// A value made with `new`, such as a database client, usually cannot be
// sent, and the page would fail when it renders. This finds such values
// when the component compiles, and names the code that reads them.

import type { SFCFile } from './ast.ts';
import type { Declaration, Diagnostic, Site } from './model.ts';
import { children } from './oxc.ts';
import type { oxc } from './oxc.ts';
import type { Plan } from './plan.ts';

/** Classes whose instances brumate can send to the browser. */
const SENDABLE = new Set([
  'Array',
  'Object',
  'Date',
  'URL',
  'URLSearchParams',
  // The web values of seroval-plugins.
  'Headers',
  'FormData',
  'Request',
  'Response',
  'ReadableStream',
  'Event',
  'CustomEvent',
  'DOMException',
  'AbortSignal',
  'ImageData',
  'Map',
  'Set',
  'Promise',
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
  'AggregateError',
  'ArrayBuffer',
  'DataView',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'String',
  'Number',
  'Boolean',
]);

/** Compile-time functions whose argument is the value, such as `$signal(new Foo())`. */
const WRAPPERS = new Set(['$signal', '$memo', '$debounced', '$throttled']);

/** The value that a declaration holds, by the offset of its name. */
export function initializers(file: SFCFile): Map<number, oxc.Node> {
  const result = new Map<number, oxc.Node>();
  function visit(node: oxc.Node): void {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
      let init: oxc.Node = node.init;
      if (
        init.type === 'CallExpression' &&
        init.callee.type === 'Identifier' &&
        WRAPPERS.has(init.callee.name) &&
        init.arguments[0]
      ) {
        init = init.arguments[0];
      }
      result.set(node.id.start, init);
    }
    for (const [, child] of children(node)) {
      visit(child);
    }
  }
  if (file.instanceScript) {
    visit(file.instanceScript.program);
  }
  return result;
}

/** The class of a value made with `new`, unless brumate or a plugin of the app can send it. */
function unsendableClass(node: oxc.Node, sendable: readonly string[]): string | undefined {
  if (node.type !== 'NewExpression') {
    return undefined;
  }
  const callee = node.callee;
  let name = 'class';
  if (callee.type === 'Identifier') {
    name = callee.name;
  } else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
    name = callee.property.name;
  }
  return SENDABLE.has(name) || sendable.includes(name) ? undefined : name;
}

/**
 * The classes that the plugins of a serial entry send: the names on the
 * right of `instanceof` in the file, such as `Money` in
 * `test: (value) => value instanceof Money`.
 */
export function entryClasses(program: oxc.Node): string[] {
  const names = new Set<string>();
  function visit(node: oxc.Node): void {
    if (node.type === 'BinaryExpression' && node.operator === 'instanceof') {
      const right = node.right;
      if (right.type === 'Identifier') {
        names.add(right.name);
      } else if (right.type === 'MemberExpression' && right.property.type === 'Identifier') {
        names.add(right.property.name);
      }
    }
    for (const [, child] of children(node)) {
      visit(child);
    }
  }
  visit(program);
  return [...names];
}

/** Errors for values that the browser reads but that cannot be sent to it. */
export function checkCaptures(
  file: SFCFile,
  plan: Plan,
  sendable: readonly string[] = [],
): Diagnostic[] {
  const values = initializers(file);
  const diagnostics: Diagnostic[] = [];
  const reported = new Set<Declaration>();
  for (const layout of plan.scopes.values()) {
    for (const declaration of layout.slots) {
      const init = values.get(declaration.range.start);
      const kind = init && unsendableClass(init, sendable);
      if (!kind || reported.has(declaration)) {
        continue;
      }
      reported.add(declaration);
      // The code in the browser that reads the value, to name it in the error.
      let reader: Site | undefined;
      for (const read of declaration.reads) {
        if (plan.graph.reached.has(read.site)) {
          reader = read.site;
          break;
        }
      }
      diagnostics.push({
        severity: 'error',
        message: `"${declaration.name}" holds a new ${kind}, which cannot be sent to the browser, and code that runs in the browser reads it${reader ? ` (${reader.label})` : ''}. Use it in a server function, or create it in the browser, such as in $client`,
        range: { start: init.start, end: init.end },
      });
    }
  }
  return diagnostics;
}
