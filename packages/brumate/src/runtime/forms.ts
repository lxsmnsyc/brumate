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
): Fields<T> {
  const value = result && !result.reset ? result.value : undefined;
  const submitted = result !== undefined;
  const errors = result && !result.reset ? result.errors : {};
  const keys = (result && !result.reset && result.keys) || {};

  const state = (path: PathSegment[], shown: unknown): FieldState => {
    const name = formatPath(path);
    const fieldId = `${id}-${name}`;
    const errorId = `${fieldId}-error`;
    const messages = Object.hasOwn(errors, name) ? errors[name] : undefined;
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
