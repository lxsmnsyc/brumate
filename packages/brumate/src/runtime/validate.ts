// Validation of server function arguments with any Standard Schema, such as
// a schema of Zod, Valibot or ArkType. The helpers run in the body of a
// server function, so they never reach the browser.

import { parsePath } from './forms.ts';
import type { PathSegment } from './forms.ts';
import { ServerError } from './request.ts';
import type { StandardSchemaV1 } from './standard-schema.ts';

/**
 * A problem that a schema found, as plain data that the server can send to
 * the browser. A path segment is a string or a number.
 */
export interface ValidationIssue {
  message: string;
  path?: (string | number)[];
}

/** The output of a schema, or the issues that it found. */
export type ParseResult<T> =
  | { value: T; issues?: undefined }
  | { value?: undefined; issues: ValidationIssue[] };

/**
 * The error that `parse` throws when the value does not match. It answers
 * with status 400 and its message, as any `ServerError` does. Its `issues`
 * stay on the server.
 */
export class ValidationError extends ServerError {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(summary(issues), { status: 400 });
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/** The longest message that `parse` sends, so a long input in a message stays short. */
const MAX_MESSAGE = 300;

/** The message of a `ValidationError`: the first issue with its path, and how many others there are. */
function summary(issues: ValidationIssue[]): string {
  const first = issues[0];
  if (!first) {
    return 'Invalid input';
  }
  const path = first.path?.join('.');
  let message = path ? `${path}: ${first.message}` : first.message;
  if (message.length > MAX_MESSAGE) {
    message = `${message.slice(0, MAX_MESSAGE)}…`;
  }
  const more = issues.length - 1;
  return more > 0 ? `${message} (${more} more ${more === 1 ? 'issue' : 'issues'})` : message;
}

/**
 * Copies an issue as plain data. A `{ key }` segment becomes its key, and a
 * symbol becomes its text, such as `Symbol(id)`. Other fields of the issue,
 * which some libraries add, are left out, so the input is not sent back.
 */
function plainIssue(issue: StandardSchemaV1.Issue): ValidationIssue {
  const plain: ValidationIssue = { message: String(issue.message) };
  if (issue.path && issue.path.length > 0) {
    plain.path = issue.path.map((segment) => {
      const key = typeof segment === 'object' && segment !== null ? segment.key : segment;
      return typeof key === 'number' ? key : String(key);
    });
  }
  return plain;
}

/**
 * Validates a value with a Standard Schema. Returns `{ value }` with the
 * output of the schema, or `{ issues }` as plain data. It does not throw for
 * a value that does not match.
 */
export async function safeParse<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
): Promise<ParseResult<StandardSchemaV1.InferOutput<S>>> {
  const props = schema['~standard'];
  if (props?.version !== 1 || typeof props.validate !== 'function') {
    throw new TypeError('The schema is not a Standard Schema of version 1');
  }
  const result = await props.validate(value);
  if (result.issues) {
    return { issues: result.issues.map(plainIssue) };
  }
  return { value: result.value as StandardSchemaV1.InferOutput<S> };
}

/**
 * Validates a value with a Standard Schema, and returns the output of the
 * schema. A value that does not match throws a `ValidationError`, which
 * answers with status 400 and a message built from the first issue.
 *
 * ```ts
 * async function save(input: unknown) {
 *   'use server';
 *   const todo = await parse(Todo, input);
 *   await db.todos.save(todo);
 * }
 * ```
 */
export async function parse<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
): Promise<StandardSchemaV1.InferOutput<S>> {
  const result = await safeParse(schema, value);
  if (result.issues) {
    throw new ValidationError(result.issues);
  }
  return result.value;
}

/**
 * Turns the entries of a form into a plain object:
 *
 * - A name that appears once holds its value.
 * - A name that appears more than once holds an array of its values.
 * - A name that ends with `[]` always holds an array, under the name without `[]`.
 * - Dots nest objects: `address.city` is `{ address: { city } }`.
 * - An index in brackets makes a list: `items[0].name` is `{ items: [{ name }] }`.
 * - Values stay strings and files.
 *
 * A name with an empty part, a part such as `__proto__`, an index above
 * 999, or one that needs an object where another field holds a value, is
 * an issue, and the schema does not run.
 */
export function formValues(
  form: FormData,
  skip?: (name: string) => boolean,
): ParseResult<Record<string, unknown>> {
  const root: Record<string, unknown> = {};
  // The objects and lists of items that this function made, so a field value is never taken for one.
  const containers = new Set<unknown>([root]);
  // The arrays of the values of a repeated name.
  const repeated = new Set<unknown>();
  const issues: ValidationIssue[] = [];
  for (const [name, value] of form) {
    if (skip?.(name)) {
      continue;
    }
    const list = name.endsWith('[]');
    const parts = parsePath(list ? name.slice(0, -2) : name);
    if (!parts) {
      issues.push({ message: 'The form has a field name that is not allowed' });
      continue;
    }
    let target = root as Record<PathSegment, unknown>;
    let conflict = false;
    for (const [index, part] of parts.slice(0, -1).entries()) {
      const next = Object.hasOwn(target, part) ? target[part] : undefined;
      // A list takes only indexes, and an object only keys.
      if (Array.isArray(target) !== (typeof part === 'number')) {
        conflict = true;
        break;
      }
      if (next === undefined) {
        const child = typeof parts[index + 1] === 'number' ? [] : {};
        containers.add(child);
        target[part] = child;
        target = child as Record<PathSegment, unknown>;
      } else if (containers.has(next)) {
        target = next as Record<PathSegment, unknown>;
      } else {
        conflict = true;
        break;
      }
    }
    const last = parts.at(-1)!;
    const current = Object.hasOwn(target, last) ? target[last] : undefined;
    if (
      conflict ||
      containers.has(current) ||
      Array.isArray(target) !== (typeof last === 'number')
    ) {
      issues.push({ message: `Field "${name}" conflicts with another field`, path: parts });
    } else if (repeated.has(current)) {
      (current as unknown[]).push(value);
    } else if (current !== undefined || list) {
      const values = current === undefined ? [value] : [current, value];
      repeated.add(values);
      target[last] = values;
    } else {
      target[last] = value;
    }
  }
  return issues.length > 0 ? { issues } : { value: root };
}

/**
 * Validates the data of a form with a Standard Schema. The entries become a
 * plain object first. Returns `{ value }` or `{ issues }`, and does not throw
 * for data that does not match, so a function of `$action` can return the
 * issues for the page to show.
 *
 * ```ts
 * async function signUp(form: FormData) {
 *   'use server';
 *   const result = await parseForm(SignUp, form);
 *   if (result.issues) {
 *     return { errors: fieldErrors(result.issues) };
 *   }
 * }
 * ```
 */
export async function parseForm<S extends StandardSchemaV1>(
  schema: S,
  form: FormData,
): Promise<ParseResult<StandardSchemaV1.InferOutput<S>>> {
  const values = formValues(form);
  if (values.issues) {
    return { issues: values.issues };
  }
  return safeParse(schema, values.value);
}

/**
 * The messages of issues by field, for a page to show next to each field.
 * The key is the path joined with dots, such as `address.city`. Issues
 * without a path, and a path of `__proto__`, are under the key `''`. The
 * result is plain data, so a server function can return it.
 */
export function fieldErrors(
  issues: readonly (StandardSchemaV1.Issue | ValidationIssue)[],
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    let key = plainIssue(issue).path?.join('.') ?? '';
    if (key === '__proto__') {
      key = '';
    }
    (Object.hasOwn(errors, key) ? errors[key]! : (errors[key] = [])).push(String(issue.message));
  }
  return errors;
}
