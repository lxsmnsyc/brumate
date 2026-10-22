// Values that code in the browser reads go to the browser with the page.
// A value made with `new`, such as a database client, usually cannot be
// sent, and the page would fail when it renders. This finds such values
// when the component compiles, and names the code that reads them.

import type { SFCFile } from './ast.ts';
import type { Declaration, Diagnostic } from './model.ts';
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
  const visit = (node: oxc.Node): void => {
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
  };
  if (file.instanceScript) {
    visit(file.instanceScript.program);
  }
  return result;
}

/** The class of a value made with `new`, unless brumate can send it. */
function unsendableClass(node: oxc.Node): string | undefined {
  if (node.type !== 'NewExpression') {
    return undefined;
  }
  const callee = node.callee;
  const name =
    callee.type === 'Identifier'
      ? callee.name
      : callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
        ? callee.property.name
        : 'class';
  return SENDABLE.has(name) ? undefined : name;
}

/** Errors for values that the browser reads but that cannot be sent to it. */
export function checkCaptures(file: SFCFile, plan: Plan): Diagnostic[] {
  const values = initializers(file);
  const diagnostics: Diagnostic[] = [];
  const reported = new Set<Declaration>();
  for (const layout of plan.scopes.values()) {
    for (const declaration of layout.slots) {
      const init = values.get(declaration.range.start);
      const kind = init && unsendableClass(init);
      if (!kind || reported.has(declaration)) {
        continue;
      }
      reported.add(declaration);
      // The code in the browser that reads the value, to name it in the error.
      const reader = declaration.reads.find((read) => plan.graph.reached.has(read.site))?.site;
      diagnostics.push({
        severity: 'error',
        message: `"${declaration.name}" holds a new ${kind}, which cannot be sent to the browser, and code that runs in the browser reads it${reader ? ` (${reader.label})` : ''}. Use it in a server function, or create it in the browser, such as in $client`,
        range: { start: init.start, end: init.end },
      });
    }
  }
  return diagnostics;
}
