// The parts of progressive forms that the server and the browser share: the
// paths of field names, intents, the reply of a submission, and the state of
// the fields that `createForm` shows. Nothing here reads the server, so the
// code of `brumate/forms` can run it in the browser.

/** A part of the path of a field: a key of an object, or an index of a list. */
export type PathSegment = string | number;

/** The name of the submit button that holds an intent. */
export const INTENT = '__intent';

/** The largest index of a list item in a field name, so a form cannot make a huge array. */
export const MAX_INDEX = 999;

/** Names that would change the prototype of an object, or reach the one of its constructor. */
export const FORBIDDEN: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * The path of a field name: `items[0].name` is `['items', 0, 'name']`.
 * Dots separate keys, and `[n]` is the index of a list item. A number
 * between dots stays a key. Undefined for a name that is not a path, such
 * as one with an empty key, an index above `MAX_INDEX`, or a key such as
 * `__proto__`.
 */
export function parsePath(name: string): PathSegment[] | undefined {
  const path: PathSegment[] = [];
  for (const part of name.split('.')) {
    const match = /^([^[\]]+)((?:\[\d+\])*)$/.exec(part);
    if (!match || FORBIDDEN.has(match[1]!)) {
      return undefined;
    }
    path.push(match[1]!);
    for (const index of match[2]!.matchAll(/\[(\d+)\]/g)) {
      const value = Number(index[1]);
      if (value > MAX_INDEX || (index[1]!.length > 1 && index[1]!.startsWith('0'))) {
        return undefined;
      }
      path.push(value);
    }
  }
  return path;
}

/** The field name of a path: `['items', 0, 'name']` is `items[0].name`. */
export function formatPath(path: readonly PathSegment[]): string {
  let name = '';
  for (const segment of path) {
    name += typeof segment === 'number' ? `[${segment}]` : name ? `.${segment}` : segment;
  }
  return name;
}

/** The value at a path, or undefined when a part of the path is missing. */
export function getAt(value: unknown, path: readonly PathSegment[]): unknown {
  let current = value;
  for (const segment of path) {
    if (typeof current !== 'object' || current === null || !Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = (current as Record<PathSegment, unknown>)[segment];
  }
  return current;
}

/**
 * A copy of `value` with `next` at the path. The objects and lists along the
 * path are copied, and the others are shared. A missing part becomes a list
 * for an index and an object for a key.
 */
export function setAt(value: unknown, path: readonly PathSegment[], next: unknown): unknown {
  if (path.length === 0) {
    return next;
  }
  const [segment, ...rest] = path as [PathSegment, ...PathSegment[]];
  const copy: Record<PathSegment, unknown> | unknown[] = Array.isArray(value)
    ? [...(value as unknown[])]
    : typeof value === 'object' && value !== null
      ? { ...value }
      : typeof segment === 'number'
        ? []
        : {};
  const child = Object.hasOwn(copy, segment)
    ? (copy as Record<PathSegment, unknown>)[segment]
    : undefined;
  (copy as Record<PathSegment, unknown>)[segment] = setAt(child, rest, next);
  return copy;
}

/** A problem that a schema found in the values of a form. */
export interface FormIssue {
  message: string;
  path?: PathSegment[];
}

/** The errors of a form: those of each field by field name, and those of the whole form. */
export interface FormErrors {
  errors: Record<string, string[]>;
  formErrors: string[];
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
):
  | { value: Record<string, unknown>; issues?: undefined }
  | { value?: undefined; issues: FormIssue[] } {
  const root: Record<string, unknown> = {};
  // The objects and lists of items that this function made, so a field value is never taken for one.
  const containers = new Set<unknown>([root]);
  // The arrays of the values of a repeated name.
  const repeated = new Set<unknown>();
  const issues: FormIssue[] = [];
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

/** The errors of issues by field name, such as `items[0].name`, and those of the whole form. */
export function groupIssues(issues: readonly FormIssue[]): FormErrors {
  const errors: Record<string, string[]> = {};
  const formErrors: string[] = [];
  for (const issue of issues) {
    const path = issue.path ?? [];
    const name = path.length > 0 && typeof path[0] === 'string' ? formatPath(path) : '';
    if (name === '' || !parsePath(name)) {
      formErrors.push(issue.message);
    } else {
      (Object.hasOwn(errors, name) ? errors[name]! : (errors[name] = [])).push(issue.message);
    }
  }
  return { errors, formErrors };
}

/** The schema of a form, as `createForm` reads it: a Standard Schema of version 1. */
interface FormSchema {
  readonly '~standard': {
    readonly validate: (value: unknown) => unknown;
  };
}

/**
 * Validates the fields of a form in the browser, with the schema that the
 * server uses, and groups the errors as `reply` does.
 */
export async function validateForm(schema: FormSchema, form: FormData): Promise<FormErrors> {
  const values = formValues(form, (name) => name === INTENT);
  if (values.issues) {
    return groupIssues(values.issues);
  }
  const result = (await schema['~standard'].validate(values.value)) as {
    issues?: readonly { message: string; path?: readonly (PathSegment | { key: PropertyKey })[] }[];
  };
  return groupIssues(
    (result.issues ?? []).map((issue) => ({
      message: String(issue.message),
      path: issue.path?.map((segment) => {
        const key = typeof segment === 'object' ? segment.key : segment;
        return typeof key === 'number' ? key : String(key);
      }),
    })),
  );
}

/**
 * The errors that the browser found since the last reply: the fields that
 * the user left or changed, and the errors of the form at that time.
 */
export interface CheckedErrors extends FormErrors {
  /** The ID of the reply that the check came after, or undefined before the first submit. */
  reply: string | undefined;
  /** The names of the fields that the user left, whose errors show. */
  touched: string[];
  /** True when the errors of every field show, as after a submit. */
  all: boolean;
}

/**
 * A change that a submit button asks for, instead of a submit. The server
 * applies it to the posted values, and answers with them.
 *
 * - `insert` adds an item to a list, at `index` or at its end.
 * - `remove` removes the item at `index`.
 * - `reorder` moves the item at `from` to `to`.
 * - `reset` sets a field, or the whole form, back to its default value.
 * - `validate` answers with the errors of one field.
 */
export type Intent =
  | { type: 'insert'; name: string; index?: number; defaultValue?: unknown }
  | { type: 'remove'; name: string; index: number }
  | { type: 'reorder'; name: string; from: number; to: number }
  | { type: 'reset'; name?: string }
  | { type: 'validate'; name: string };

const isIndex = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_INDEX;

/**
 * Reads the intent that a submit button posted, as JSON. Undefined for a
 * value that is not an intent, such as one with a name that is not a path.
 */
export function parseIntent(text: string): Intent | undefined {
  let intent: unknown;
  try {
    intent = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof intent !== 'object' || intent === null) {
    return undefined;
  }
  const { type, name, index, from, to } = intent as Record<string, unknown>;
  if (name !== undefined && (typeof name !== 'string' || !parsePath(name))) {
    return undefined;
  }
  switch (type) {
    case 'insert':
      return name !== undefined && (index === undefined || isIndex(index))
        ? (intent as Intent)
        : undefined;
    case 'remove':
      return name !== undefined && isIndex(index) ? (intent as Intent) : undefined;
    case 'reorder':
      return name !== undefined && isIndex(from) && isIndex(to) ? (intent as Intent) : undefined;
    case 'reset':
      return intent as Intent;
    case 'validate':
      return name !== undefined ? (intent as Intent) : undefined;
    default:
      return undefined;
  }
}

/** The value of a submit button that posts an intent. */
export function intentValue(intent: Intent): string {
  return JSON.stringify(intent);
}

/**
 * Applies an intent to the posted values. Returns the new values, and the
 * name of the list that it changed. Undefined when the intent does not fit
 * the values, such as an index past the end of the list.
 */
export function applyIntent(
  value: unknown,
  intent: Intent,
): { value: unknown; list?: string } | undefined {
  if (intent.type === 'validate') {
    return { value };
  }
  if (intent.type === 'reset') {
    return {
      value:
        intent.name === undefined ? undefined : setAt(value, parsePath(intent.name)!, undefined),
    };
  }
  const path = parsePath(intent.name)!;
  const current = getAt(value, path) ?? [];
  if (!Array.isArray(current)) {
    return undefined;
  }
  const items = [...current];
  if (intent.type === 'insert') {
    const index = intent.index ?? items.length;
    if (index > items.length || items.length > MAX_INDEX) {
      return undefined;
    }
    items.splice(index, 0, intent.defaultValue);
  } else if (intent.type === 'remove') {
    if (intent.index >= items.length) {
      return undefined;
    }
    items.splice(intent.index, 1);
  } else {
    if (intent.from >= items.length || intent.to >= items.length) {
      return undefined;
    }
    items.splice(intent.to, 0, ...items.splice(intent.from, 1));
  }
  return { value: setAt(value, path, items), list: intent.name };
}

/**
 * What a server function of a form answers, for `createForm` to show. It is
 * plain data, so it goes through `$action` and the state of the page.
 */
export interface SubmissionResult {
  /** `success` when the values passed the schema, `error` when not, and `intent` for an intent. */
  status: 'success' | 'error' | 'intent';
  /**
   * The values as posted, after the intent, for the fields to show again.
   * Files and hidden fields are left out. Undefined after a reset, so the
   * fields show their default values.
   */
  value?: unknown;
  /** The errors of each field, by field name, such as `items[0].name`. */
  errors: Record<string, string[]>;
  /** The errors of the whole form. */
  formErrors: string[];
  /**
   * The keys of the items of a list that an intent changed, by field name.
   * They are new, so `#for … by` renders the items again, and an element
   * never shows another item. Other lists keep the index as the key.
   */
  keys: Record<string, string[]>;
  /** True when the form goes back to its default values, such as after a save. */
  reset?: boolean;
  /** A new ID for each reply, which keys of new items start with. */
  id: string;
}

/** The attributes of a submit button that posts an intent. They work without scripts. */
export interface IntentAttributes {
  type: 'submit';
  name: typeof INTENT;
  value: string;
  formnovalidate: true;
}

/** The attributes of a field that `createForm` gives. */
export interface FieldAttributes {
  name: string;
  id: string;
  'aria-invalid'?: 'true';
  'aria-describedby'?: string;
  value?: string;
  checked?: boolean;
}

/** The state of a field: its name, its value and its errors. */
export interface FieldState<T = unknown> {
  /** The field name, such as `items[0].name`. */
  name: string;
  /** The ID of the input, for a `<label for>`. */
  id: string;
  /** The value that the field shows: the posted value after a submit, or the default value. */
  value: T | undefined;
  /** The errors of the field, or undefined when it has none. */
  errors: string[] | undefined;
  /** The attributes of the input: `name`, `id`, the ARIA state of its errors and its value. */
  attrs: FieldAttributes;
  /** The attributes of the element that shows the errors: its ID, and `role="alert"` after a submit. */
  errorAttrs: { id: string; role?: 'alert' };
}

/** An item of a list field. */
export type ListItem<T> = Field<T> & {
  /** A key that stays with the item when others are added or removed, for `#for … by`. */
  key: string;
  index: number;
  /** The attributes of a button that removes the item. */
  remove: IntentAttributes;
  /** The attributes of a button that moves the item up, or down. */
  moveUp: IntentAttributes;
  moveDown: IntentAttributes;
};

/** A field, typed by its value: a list has its items, and an object its fields. */
export type Field<T> = FieldState<T> &
  (NonNullable<T> extends readonly (infer Item)[]
    ? {
        list: ListItem<Item>[];
        /** The attributes of a button that adds an item at the end of the list. */
        insert: IntentAttributes;
      }
    : NonNullable<T> extends Date | File | Blob
      ? unknown
      : NonNullable<T> extends object
        ? { fields: Fields<NonNullable<T>> }
        : unknown);

/** The fields of an object, by key. */
export type Fields<T> = { [K in keyof T]-?: Field<T[K]> };

const isFile = (value: unknown): boolean => typeof Blob !== 'undefined' && value instanceof Blob;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !isFile(value) &&
  !(value instanceof Date);

/** The attributes of a submit button that posts an intent. */
export function intentButton(intent: Intent): IntentAttributes {
  return { type: 'submit', name: INTENT, value: intentValue(intent), formnovalidate: true };
}

/**
 * The fields of a form, from its default value and the reply of its last
 * submit. A field exists for each key of the default value or of the posted
 * value, so the default value names every field that the form shows.
 */
export function formFields<T>(
  id: string,
  defaultValue: T | undefined,
  result: SubmissionResult | undefined,
  checked?: CheckedErrors,
): Fields<T> {
  const value = result && !result.reset ? result.value : undefined;
  const submitted = result !== undefined;
  const replied = result && !result.reset ? result.errors : {};
  const keys = (result && !result.reset && result.keys) || {};
  // The errors that the browser found replace those of the reply, for the fields that it checked.
  const current = checkedSince(checked, result);
  const shows = (name: string): boolean =>
    current !== undefined && (current.all || current.touched.includes(name));
  const errorsOf = (name: string): string[] | undefined => {
    const source = shows(name) ? current!.errors : replied;
    return Object.hasOwn(source, name) ? source[name] : undefined;
  };

  const state = (path: PathSegment[], shown: unknown): FieldState => {
    const name = formatPath(path);
    const fieldId = `${id}-${name}`;
    const errorId = `${fieldId}-error`;
    const messages = errorsOf(name);
    const attrs: FieldAttributes = { name, id: fieldId };
    if (messages) {
      attrs['aria-invalid'] = 'true';
      attrs['aria-describedby'] = errorId;
    }
    if (typeof shown === 'string' || typeof shown === 'number') {
      attrs.value = String(shown);
    } else if (typeof shown === 'boolean') {
      attrs.checked = shown;
    }
    return {
      name,
      id: fieldId,
      value: shown,
      errors: messages,
      attrs,
      errorAttrs: submitted ? { id: errorId, role: 'alert' } : { id: errorId },
    };
  };

  // After a submit, the fields show what was posted, and a field that was not posted, such as a
  // checkbox that was not checked, is empty. The default value still gives the shape.
  const posted = value !== undefined;
  const field = (path: PathSegment[], fallback: unknown, sent: unknown): unknown => {
    const shown = posted ? sent : fallback;
    const own = state(path, shown);
    // A list stays a list when nothing of it was posted, such as a list with no items.
    if (Array.isArray(shown) || Array.isArray(fallback)) {
      const items = Array.isArray(shown) ? shown : [];
      const name = own.name;
      const itemKeys = Object.hasOwn(keys, name) ? keys[name] : undefined;
      const defaults: unknown[] = Array.isArray(fallback) ? fallback : [];
      const list = items.map((item, index) =>
        Object.assign(
          // A new item takes the shape of the first default item.
          field([...path, index], defaults[index] ?? defaults[0], item) as object,
          {
            key: itemKeys?.[index] ?? String(index),
            index,
            remove: intentButton({ type: 'remove', name, index }),
            moveUp: intentButton({
              type: 'reorder',
              name,
              from: index,
              to: Math.max(index - 1, 0),
            }),
            moveDown: intentButton({
              type: 'reorder',
              name,
              from: index,
              to: Math.min(index + 1, items.length - 1),
            }),
          },
        ),
      );
      return Object.assign(own, { list, insert: intentButton({ type: 'insert', name }) });
    }
    if (isPlainObject(shown) || isPlainObject(fallback)) {
      const defaults = isPlainObject(fallback) ? fallback : {};
      const values = isPlainObject(sent) ? sent : {};
      const fields: Record<string, unknown> = {};
      for (const key of new Set([...Object.keys(defaults), ...Object.keys(posted ? values : {})])) {
        fields[key] = field(
          [...path, key],
          Object.hasOwn(defaults, key) ? defaults[key] : undefined,
          Object.hasOwn(values, key) ? values[key] : undefined,
        );
      }
      return path.length === 0 ? fields : Object.assign(own, { fields });
    }
    return own;
  };

  return field([], defaultValue, value) as Fields<T>;
}

/** The check of the browser when it came after the last reply, or undefined when a reply came after it. */
export function checkedSince(
  checked: CheckedErrors | undefined,
  result: SubmissionResult | undefined,
): CheckedErrors | undefined {
  return checked && checked.reply === result?.id ? checked : undefined;
}

/**
 * The errors of the whole form: those that the browser found, when it
 * checked every field since the last reply, or else those of the reply.
 */
export function formErrorsOf(
  result: SubmissionResult | undefined,
  checked: CheckedErrors | undefined,
): string[] | undefined {
  const current = checkedSince(checked, result);
  const errors = current?.all ? current.formErrors : result?.formErrors;
  return errors && errors.length > 0 ? errors : undefined;
}

/**
 * The next check of the browser, after the user leaves or changes a field.
 * A field counts once the user leaves it. After a submit, every field counts.
 * Undefined when the event changes nothing, such as typing in a field that
 * the user has not left yet.
 */
export async function checkField(
  schema: FormSchema,
  form: HTMLFormElement | null,
  name: string,
  left: boolean,
  checked: CheckedErrors | undefined,
  result: SubmissionResult | undefined,
): Promise<CheckedErrors | undefined> {
  const current = checkedSince(checked, result);
  const all = result !== undefined && !result.reset;
  const touched = current?.touched ?? [];
  if (!form || !name || name === INTENT || (!left && !all && !touched.includes(name))) {
    return undefined;
  }
  const report = await validateForm(schema, new FormData(form));
  return {
    ...report,
    reply: result?.id,
    touched: touched.includes(name) ? touched : [...touched, name],
    all,
  };
}

/**
 * The attributes of a submit button that the form presses on Enter. Without
 * it, Enter in a field presses the first submit button of the form, which
 * can be an intent button, such as "Remove". It is hidden from sight and
 * from assistive technology, and cannot take focus.
 */
export const DEFAULT_SUBMIT = {
  type: 'submit',
  tabindex: -1,
  'aria-hidden': 'true',
  style:
    'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;padding:0;margin:-1px',
} as const;
