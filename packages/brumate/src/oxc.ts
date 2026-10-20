import { parseSync } from 'oxc-parser';
import type * as oxc from '@oxc-project/types';
import type { Fail } from './error.ts';

export type { oxc };

const SKIPPED_KEYS = new Set(['type', 'start', 'end', 'range', 'loc', 'parent']);

/** Returns the child nodes of a node, with the key that holds each. */
export function* children(node: object): Generator<[key: string, child: oxc.Node]> {
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_KEYS.has(key) || value === null || typeof value !== 'object') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && typeof item === 'object' && typeof item.type === 'string') {
          yield [key, item];
        }
      }
    } else if (typeof value.type === 'string') {
      yield [key, value];
    }
  }
}

// Moves every node by `delta`, so offsets point into the whole file.
function shift(node: object, delta: number, seen: WeakSet<object>): void {
  if (seen.has(node)) {
    return;
  }
  seen.add(node);
  const span = node as { start?: number; end?: number };
  if (typeof span.start === 'number' && typeof span.end === 'number') {
    span.start += delta;
    span.end += delta;
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && typeof item === 'object') {
          shift(item, delta, seen);
        }
      }
    } else if (value !== null && typeof value === 'object') {
      shift(value, delta, seen);
    }
  }
}

function parse(code: string, delta: number, fail: Fail): oxc.Program {
  const result = parseSync('source.ts', code, { lang: 'ts', preserveParens: false });
  const error = result.errors[0];
  if (error) {
    fail(error.message, (error.labels[0]?.start ?? 0) + delta);
  }
  shift(result.program, delta, new WeakSet());
  return result.program;
}

/** Parses a script whose code starts at `offset` in the file. */
export function parseScript(code: string, offset: number, fail: Fail): oxc.Program {
  return parse(code, offset, fail);
}

/** Parses an expression whose code starts at `offset` in the file. */
export function parseExpression(code: string, offset: number, fail: Fail): oxc.Expression {
  if (code.trim() === '') {
    fail('Expected an expression', offset);
  }
  const program = parse(`(${code}\n)`, offset - 1, fail);
  const statement = program.body[0];
  if (program.body.length !== 1 || statement?.type !== 'ExpressionStatement') {
    return fail('Expected an expression', offset);
  }
  return statement.expression;
}

/** Parses a binding pattern, such as the item of `#for`. */
export function parsePattern(code: string, offset: number, fail: Fail): oxc.BindingPattern {
  const prefix = 'let ';
  const program = parse(`${prefix}${code} = 0;`, offset - prefix.length, fail);
  const statement = program.body[0];
  if (statement?.type !== 'VariableDeclaration') {
    return fail('Expected a binding pattern', offset);
  }
  return statement.declarations[0]!.id;
}

/** Parses function parameters, such as those of `#template`. */
export function parseParameters(code: string, offset: number, fail: Fail): oxc.ParamPattern[] {
  const prefix = 'function f(';
  const program = parse(`${prefix}${code}\n) {}`, offset - prefix.length, fail);
  const statement = program.body[0];
  if (statement?.type !== 'FunctionDeclaration') {
    return fail('Expected parameters', offset);
  }
  return statement.params;
}

/** Returns the names that a binding pattern declares. */
export function getPatternNames(
  pattern: oxc.Node,
  names: oxc.BindingIdentifier[] = [],
): oxc.BindingIdentifier[] {
  switch (pattern.type) {
    case 'Identifier':
      names.push(pattern as oxc.BindingIdentifier);
      break;
    case 'ObjectPattern':
      for (const property of pattern.properties) {
        getPatternNames(
          property.type === 'RestElement' ? property.argument : property.value,
          names,
        );
      }
      break;
    case 'ArrayPattern':
      for (const element of pattern.elements) {
        if (element) {
          getPatternNames(element, names);
        }
      }
      break;
    case 'AssignmentPattern':
      getPatternNames(pattern.left, names);
      break;
    case 'RestElement':
      getPatternNames(pattern.argument, names);
      break;
    case 'TSParameterProperty':
      getPatternNames(pattern.parameter, names);
      break;
    default:
      break;
  }
  return names;
}
