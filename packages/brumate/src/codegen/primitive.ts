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

/** The operators of a binary expression that compare without a conversion. */
const STRICT_OPERATORS = new Set(['===', '!==']);

/** The operators of a unary expression that do not convert their operand to a number. */
const PLAIN_UNARY = new Set(['!', 'typeof', 'void']);

/**
 * True for an expression that evaluates without a throw, whatever its names hold. It has no
 * conversion that can throw, such as `big + 1` for a BigInt, a symbol or a `valueOf` that throws:
 * a name, a literal, an array or object without a spread, a function, `===`, `!==`, `!`, `typeof`,
 * `void`, `&&`, `||`, `??` and `?:` over those. `safe` tells which names do not throw when read.
 */
export function cannotThrow(
  node: oxc.Node,
  safe: (name: oxc.Node) => boolean = () => true,
): boolean {
  switch (node.type) {
    case 'Identifier':
      return safe(node);
    case 'Literal':
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return true;
    case 'TemplateLiteral':
      return node.expressions.length === 0;
    case 'CallExpression':
      // Both become `false`, so their argument is not read.
      return (
        node.callee.type === 'Identifier' &&
        (node.callee.name === '$isPending' || node.callee.name === '$isBound')
      );
    case 'UnaryExpression':
      return PLAIN_UNARY.has(node.operator) && cannotThrow(node.argument, safe);
    case 'BinaryExpression':
      return (
        STRICT_OPERATORS.has(node.operator) &&
        cannotThrow(node.left, safe) &&
        cannotThrow(node.right, safe)
      );
    case 'LogicalExpression':
      return cannotThrow(node.left, safe) && cannotThrow(node.right, safe);
    case 'ConditionalExpression':
      return (
        cannotThrow(node.test, safe) &&
        cannotThrow(node.consequent, safe) &&
        cannotThrow(node.alternate, safe)
      );
    case 'ArrayExpression':
      return allCannotThrow(node.elements, safe);
    case 'ObjectExpression': {
      const values: oxc.Node[] = [];
      for (const property of node.properties) {
        if (property.type !== 'Property' || property.kind !== 'init' || property.computed) {
          return false;
        }
        values.push(property.value);
      }
      return allCannotThrow(values, safe);
    }
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return cannotThrow(node.expression, safe);
    default:
      return false;
  }
}

/** True when none of the expressions throws. A hole or a spread of an array counts as a throw. */
function allCannotThrow(nodes: (oxc.Node | null)[], safe: (name: oxc.Node) => boolean): boolean {
  for (const node of nodes) {
    if (node === null || node.type === 'SpreadElement' || !cannotThrow(node, safe)) {
      return false;
    }
  }
  return true;
}
