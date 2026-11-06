import type { oxc } from '../oxc.ts';

/**
 * True if an expression always gives a primitive, so it is never a promise
 * or an async iterable. A name is a primitive when `plain` says that it reads
 * a declaration that holds one.
 */
export function isPrimitive(
  node: oxc.Node,
  plain: (name: oxc.Node) => boolean = () => false,
): boolean {
  switch (node.type) {
    case 'Identifier':
      return plain(node);
    case 'Literal':
      return !('regex' in node && node.regex);
    case 'TemplateLiteral':
    case 'BinaryExpression':
    case 'UnaryExpression':
      return true;
    case 'LogicalExpression':
      return isPrimitive(node.left, plain) && isPrimitive(node.right, plain);
    case 'ConditionalExpression':
      return isPrimitive(node.consequent, plain) && isPrimitive(node.alternate, plain);
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      return isPrimitive(node.expression, plain);
    default:
      return false;
  }
}

/** Expressions whose value is never a promise, as the memo of a list or a function. */
const NEVER_PROMISE = new Set(['ArrayExpression', 'ArrowFunctionExpression', 'FunctionExpression']);

/** True for an expression that gives a primitive, an array or a function, never a promise. */
export function neverPromise(node: oxc.Node): boolean {
  return isPrimitive(node) || NEVER_PROMISE.has(node.type);
}
