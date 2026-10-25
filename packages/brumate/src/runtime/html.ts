// HTML string helpers that the server and the client both use.

const RAW: unique symbol = Symbol.for('brumate.raw');

/** HTML that is inserted as it is, such as the output of a template. */
export interface Raw {
  [RAW]: string;
}

// A class, not an object literal, so serializers can skip their test for raw HTML on plain objects.
class RawHTML implements Raw {
  readonly [RAW]: string;

  constructor(html: string) {
    this[RAW] = html;
  }
}

export function raw(html: string): Raw {
  return new RawHTML(html);
}

export function isRaw(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && RAW in value;
}

export function rawHTML(value: Raw): string {
  return value[RAW];
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

const toEscape = (char: string): string => ESCAPES[char]!;

// Most text has nothing to escape, so a test without the global flag skips the replace.
export function escape(value: string): string {
  return /[&<>]/.test(value) ? value.replace(/[&<>]/g, toEscape) : value;
}

export function escapeAttribute(value: string): string {
  return /[&<"]/.test(value) ? value.replace(/[&<"]/g, toEscape) : value;
}

/** Renders a value inserted in markup. Promises are not awaited. */
export function insertValue(value: unknown): string {
  if (isRaw(value)) {
    return value[RAW];
  }
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map(insertValue).join('');
  }
  return escape(String(value));
}

/**
 * Renders a value as the text of an element whose content is text, such as
 * a `<textarea>`, as `insertValue` does but without escaping.
 */
export function textValue(value: unknown): string {
  if (isRaw(value)) {
    return value[RAW];
  }
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map(textValue).join('');
  }
  return String(value);
}

function toKebabCase(name: string): string {
  return name.startsWith('--') ? name : name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

export function classValue(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return value ? String(value) : '';
  }
  let text = '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const part = classValue(item);
      if (part !== '') {
        text = text === '' ? part : `${text} ${part}`;
      }
    }
    return text;
  }
  // An empty name still adds a space between its neighbours, as in a join.
  let first = true;
  for (const name in value) {
    if (Object.hasOwn(value, name) && (value as Record<string, unknown>)[name]) {
      text = first ? name : `${text} ${name}`;
      first = false;
    }
  }
  return text;
}

/**
 * Renders a `class` attribute from classes that each have a space before
 * them, which the compiler builds from a literal class value. The classes
 * are escaped already. No class renders nothing.
 */
export function classAttribute(classes: string): string {
  return classes === '' ? '' : ` class="${classes.slice(1)}"`;
}

function styleValue(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined && item !== false)
      .map(([name, item]) => `${toKebabCase(name)}:${String(item)}`)
      .join(';');
  }
  return String(value);
}

/** The brand of a binding of `$bind`, under the key of the registry. See `Binding`. */
const BOUND = Symbol.for('brumate.binding');

/** The words of an attribute that says `true` or `false` in its value. */
const TRUE_FALSE = ['true', 'false'] as const;

/**
 * Attributes whose two states are words in the value, not whether the
 * attribute is there, by their words for `true` and `false`. A missing
 * attribute means a third state, such as the default of the element, so
 * `false` must not remove it. `aria-*` and `data-*` are such attributes too.
 */
const SWITCHES = new Map<string, readonly [string, string]>([
  ['contenteditable', TRUE_FALSE],
  ['draggable', TRUE_FALSE],
  ['spellcheck', TRUE_FALSE],
  ['writingsuggestions', TRUE_FALSE],
  // SVG.
  ['focusable', TRUE_FALSE],
  ['translate', ['yes', 'no']],
  ['autocomplete', ['on', 'off']],
  ['autocorrect', ['on', 'off']],
]);

/** The words of `true` and `false` for an attribute that says them in its value, or undefined. */
function switchWords(name: string): readonly [string, string] | undefined {
  const lower = name.toLowerCase();
  if (lower.startsWith('aria-') || lower.startsWith('data-')) {
    return TRUE_FALSE;
  }
  return SWITCHES.get(lower);
}

/**
 * Returns the text of an attribute, or undefined if the attribute is not
 * rendered.
 *
 * - `null` and `undefined` leave the attribute out.
 * - For an attribute whose value says its state, such as `aria-expanded`,
 *   `draggable` or `translate`, `true` and `false` render as its words:
 *   `"true"` and `"false"`, or `"yes"` and `"no"`, or `"on"` and `"off"`.
 * - For other attributes, such as `disabled`, `true` renders the attribute
 *   without a value, and `false` leaves it out.
 */
export function attributeText(name: string, value: unknown): string | undefined {
  // `value=$bind(name)` on an element renders the value of the name.
  if (typeof value === 'object' && value !== null && BOUND in value) {
    value = (value as unknown as { value: unknown }).value;
  }
  if (value === null || value === undefined || typeof value === 'function') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    const words = switchWords(name);
    if (words) {
      return value ? words[0] : words[1];
    }
    return value ? '' : undefined;
  }
  if (name === 'class') {
    const text = classValue(value);
    return text === '' ? undefined : text;
  }
  return name === 'style' ? styleValue(value) : String(value);
}

/**
 * A name that HTML reads as one attribute. A spread takes its names from
 * data, so a name with a space, a quote, `>`, `/` or `=` could write other
 * attributes or markup.
 */
// oxlint-disable-next-line no-control-regex -- HTML reads no control character in a name.
const ATTRIBUTE_NAME = /^[^\s"'>/=\x00-\x1f\x7f]+$/;

/** Renders one attribute, with a leading space. A name that is not one attribute renders nothing. */
export function attribute(name: string, value: unknown): string {
  const text = attributeText(name, value);
  if (text === undefined || !ATTRIBUTE_NAME.test(name)) {
    return '';
  }
  return value === true && text === '' ? ` ${name}` : ` ${name}="${escapeAttribute(text)}"`;
}

/**
 * Returns the value of a style variable with text around it, such as `12px`
 * for `${size}px`. A value that sets no variable stays as it is.
 */
export function affix(prefix: string, value: unknown, suffix: string): unknown {
  return value === null || value === undefined || value === false
    ? value
    : `${prefix}${String(value)}${suffix}`;
}

/** Returns a style with custom properties before an element's own style. */
export function vars(variables: Record<string, unknown>, own: unknown): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(variables)) {
    if (value !== null && value !== undefined && value !== false) {
      parts.push(`${name}:${String(value)}`);
    }
  }
  const rest = own === null || own === undefined || own === false ? '' : styleValue(own);
  if (rest) {
    parts.push(rest);
  }
  return parts.join(';');
}

/** Returns a `<style>` element for a component's stylesheet. */
export function styleElement(id: string, css: string): string {
  return `<style b-style="${escapeAttribute(id)}">${css.replace(/<\/style/gi, '<\\/style')}</style>`;
}

/**
 * Merges the attributes of an element that has spreads, in their order: a
 * later value wins, except `class`, whose values all apply.
 */
export function mergeAttributes(
  parts: Record<string, unknown>[],
  variables?: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const part of parts) {
    for (const [name, value] of Object.entries(part ?? {})) {
      result[name] =
        name === 'class' && result.class !== undefined && value !== undefined
          ? [result.class, value]
          : value;
    }
  }
  // The style variables of the component come before the style that won, whoever gave it.
  if (variables) {
    result.style = vars(variables, result.style);
  }
  return result;
}

/**
 * The `b-on` entry of a handler that a spread passes on, such as
 * `click:prevent=Parent#h1@3`: its event, the modifiers of its wrappers, its
 * client function and the scope it runs in. A handler that `$handler` made
 * has its arguments after another `@`, encoded so that they hold no space.
 */
export function handlerEntry(
  name: string,
  ref: string,
  scope: number | string,
  modifiers: readonly string[] = [],
  args?: unknown[],
): string {
  const bound = args === undefined ? '' : `@${encodeURIComponent(JSON.stringify(args))}`;
  return `${[name.slice(2).toLowerCase(), ...modifiers].join(':')}=${ref}@${scope}${bound}`;
}

/**
 * The `b-on` entry of a binding that a spread puts on `value` or `checked`
 * of an element. It names the scope of the slot, or of the setter of
 * `$bind(name, fn)`, after `@`. A box writes on `change`.
 */
export function bindEntry(
  name: string,
  ref: { scope: number | string; slot: number },
  setter?: { ref: string; scope: number | string },
): string {
  const event = name === 'checked' ? 'change' : 'input';
  return setter
    ? `${event}=$set:${setter.ref}@${setter.scope}`
    : `${event}=$bind#0.${ref.slot}@${ref.scope}`;
}

/**
 * The `b-on` attribute of an element with spreads: the bindings of its
 * spreads, so its handlers read the new value, then its own handlers, then
 * those of its spreads.
 */
export function onAttribute(on: string[], own: string): string {
  const value = onValue(on, own);
  return value ? ` b-on="${escapeAttribute(value)}"` : '';
}

/** The value of `b-on`, in the order of `onAttribute`. */
export function onValue(on: string[], own: string): string {
  const bindings = on.filter((entry) => /=\$(bind#|set:)/.test(entry));
  return [...bindings, own, ...on.filter((entry) => !bindings.includes(entry))]
    .filter(Boolean)
    .join(' ');
}

/** Renders an object of attributes. */
export function spread(attributes: Record<string, unknown>): string {
  let result = '';
  for (const [name, value] of Object.entries(attributes)) {
    if (name !== 'children' && !/^on[A-Z]/.test(name)) {
      result += attribute(name, value);
    }
  }
  return result;
}

export const VOID_ELEMENTS: Set<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/**
 * Renders the attributes of a form that posts to a server function, such as
 * ` action="/_brumate/App_1abc%23save" method="post"`. `method` is the name of
 * the method attribute to add, if the element has none. `build` is the ID
 * of the build of the page, which the URL carries as `__build`, so the
 * server can tell a post from before a deploy without scripts.
 */
export function actionAttributes(
  prefix: string,
  name: string,
  id: string,
  method?: string,
  result?: string,
  build?: string,
  key?: string,
): string {
  const methodText = method ? ` ${method}="post"` : '';
  // The key of a form of a function that `idempotent` made, so a second post gets the first result.
  const query = [
    build === undefined ? '' : `__build=${encodeURIComponent(build)}`,
    key === undefined ? '' : `__key=${key}`,
  ]
    .filter(Boolean)
    .join('&');
  if (result !== undefined) {
    // The form posts to its page, which renders with the result. With the
    // loader, the result is written into the `$action` at `result` instead.
    const url = `?__action=${encodeURIComponent(id)}${query ? `&${query}` : ''}`;
    return ` ${name}="${escapeAttribute(url)}"${methodText} b-action="${escapeAttribute(id)}" b-result="${escapeAttribute(result)}"`;
  }
  const url = `${prefix}/${encodeURIComponent(id)}${query ? `?${query}` : ''}`;
  return ` ${name}="${escapeAttribute(url)}"${methodText}`;
}
