// The server side of progressive forms: reads a submission, applies its
// intent, validates it, and builds the reply that `createForm` shows.

import {
  INTENT,
  applyIntent,
  formValues,
  formatPath,
  getAt,
  groupIssues,
  parseIntent,
  parsePath,
} from './forms.ts';
import type { Intent, PathSegment, SubmissionResult } from './forms.ts';
import type { StandardSchemaV1 } from './standard-schema.ts';
import { safeParse } from './validate.ts';
import type { ValidationIssue } from './validate.ts';

/** What a server function adds to the reply of a submission. */
export interface ReplyOptions {
  /** Errors of the whole form, such as "That email is taken". */
  formErrors?: string[];
  /** Errors of fields, by field name, such as `{ email: ['That email is taken'] }`. */
  fieldErrors?: Record<string, string[]>;
  /** Sets the form back to its default values, such as after a save. */
  reset?: boolean;
}

/** The options of `parseSubmission`. */
export interface SubmissionOptions {
  /**
   * Field names whose values are never sent back, such as `password`. Files
   * are never sent back either, because a file input cannot be filled.
   */
  hide?: string[];
}

interface SubmissionBase {
  /** The posted values, after the intent, before the schema. */
  payload: Record<string, unknown> | undefined;
  /** The reply for `createForm`, with the errors of the submission and of `options`. */
  reply(options?: ReplyOptions): SubmissionResult;
}

/** A submission whose values passed the schema. */
export interface SuccessfulSubmission<T> extends SubmissionBase {
  status: 'success';
  /** The output of the schema. */
  value: T;
  intent?: undefined;
}

/** A submission whose values did not pass the schema, or whose names or intent were not allowed. */
export interface FailedSubmission extends SubmissionBase {
  status: 'error';
  value?: undefined;
  intent?: Intent;
  issues: ValidationIssue[];
}

/** A submission of an intent button, such as "Add an item". It is not a save. */
export interface IntentSubmission extends SubmissionBase {
  status: 'intent';
  value?: undefined;
  intent: Intent;
}

/** A submission of a form: a success, an error, or an intent. */
export type Submission<T> = SuccessfulSubmission<T> | FailedSubmission | IntentSubmission;

/** True for a file, so it is not sent back. */
const isBlob = (value: unknown): boolean => typeof Blob !== 'undefined' && value instanceof Blob;

/** The values to send back: without files and hidden fields. */
function echo(value: unknown, hidden: Set<string>, path: PathSegment[] = []): unknown {
  if (path.length > 0 && hidden.has(formatPath(path))) {
    return undefined;
  }
  if (isBlob(value)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => echo(item, hidden, [...path, index]));
  }
  if (typeof value === 'object' && value !== null) {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const next = echo(item, hidden, [...path, key]);
      if (next !== undefined) {
        copy[key] = next;
      }
    }
    return copy;
  }
  return value;
}

/** A new ID for a reply, which the keys of the items of a changed list start with. */
function replyId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Reads the data of a form that `createForm` shows. It turns the entries
 * into an object, as `parseForm` does, applies the intent of the button
 * that was pressed, and validates the values with a Standard Schema when
 * the button was not an intent. It does not throw for data that does not
 * match. `reply()` gives what the function returns, for `createForm` to show.
 *
 * ```ts
 * async function save(form: FormData) {
 *   'use server';
 *   const submission = await parseSubmission(Order, form);
 *   if (submission.status !== 'success') {
 *     return submission.reply();
 *   }
 *   await db.orders.save(submission.value);
 *   return submission.reply({ reset: true });
 * }
 * ```
 */
export async function parseSubmission<S extends StandardSchemaV1>(
  schema: S,
  form: FormData,
  options: SubmissionOptions = {},
): Promise<Submission<StandardSchemaV1.InferOutput<S>>> {
  const hidden = new Set(options.hide);
  const id = replyId();
  const make = (
    status: SubmissionResult['status'],
    payload: Record<string, unknown> | undefined,
    issues: ValidationIssue[],
    list?: string,
  ) => ({
    payload,
    reply(reply: ReplyOptions = {}): SubmissionResult {
      const grouped = groupIssues(issues);
      const errors = { ...grouped.errors };
      for (const [name, messages] of Object.entries(reply.fieldErrors ?? {})) {
        errors[name] = [...(Object.hasOwn(errors, name) ? errors[name]! : []), ...messages];
      }
      const keys: Record<string, string[]> = {};
      const items = list === undefined ? undefined : getAt(payload, parsePath(list)!);
      if (list !== undefined && Array.isArray(items)) {
        keys[list] = items.map((_, index) => `${id}-${index}`);
      }
      const result: SubmissionResult = {
        status,
        value: reply.reset ? undefined : echo(payload, hidden),
        errors: reply.reset ? {} : errors,
        formErrors: [...grouped.formErrors, ...(reply.formErrors ?? [])],
        keys: reply.reset ? {} : keys,
        id,
      };
      if (reply.reset) {
        result.reset = true;
      }
      return result;
    },
  });

  const raw = form.get(INTENT);
  const values = formValues(form, (name) => name === INTENT);
  if (values.issues) {
    return { status: 'error', issues: values.issues, ...make('error', undefined, values.issues) };
  }
  let payload: Record<string, unknown> | undefined = values.value;
  if (raw === null) {
    const result = await safeParse(schema, payload);
    if (result.issues) {
      return { status: 'error', issues: result.issues, ...make('error', payload, result.issues) };
    }
    return { status: 'success', value: result.value, ...make('success', payload, []) };
  }
  const intent = typeof raw === 'string' ? parseIntent(raw) : undefined;
  const applied = intent && applyIntent(payload, intent);
  if (!intent || !applied) {
    const issues = [{ message: 'The form asked for a change that it cannot make' }];
    return { status: 'error', intent, issues, ...make('error', payload, issues) };
  }
  payload = (applied.value ?? undefined) as Record<string, unknown> | undefined;
  if (intent.type === 'validate') {
    // Only the errors of the field and of the fields in it, so untouched fields show none.
    const result = await safeParse(schema, payload);
    const name = intent.name;
    const issues = (result.issues ?? []).filter((issue) => {
      const path = issue.path ? formatPath(issue.path) : '';
      return path === name || path.startsWith(`${name}.`) || path.startsWith(`${name}[`);
    });
    return { status: 'intent', intent, ...make('intent', payload, issues) };
  }
  return { status: 'intent', intent, ...make('intent', payload, [], applied.list) };
}
