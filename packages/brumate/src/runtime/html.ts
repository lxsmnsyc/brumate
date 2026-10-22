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

/**
 * Returns the text of an attribute, or undefined if the attribute is not
 * rendered. `true` renders as an empty value.
 */
export function attributeText(name: string, value: unknown): string | undefined {
  if (value === null || value === undefined || value === false || typeof value === 'function') {
    return undefined;
  }
  if (value === true) {
    return '';
  }
  if (name === 'class') {
    const text = classValue(value);
    return text === '' ? undefined : text;
  }
  return name === 'style' ? styleValue(value) : String(value);
}

/** Renders one attribute, with a leading space. */
export function attribute(name: string, value: unknown): string {
  const text = attributeText(name, value);
  if (text === undefined) {
    return '';
  }
  return value === true ? ` ${name}` : ` ${name}="${escapeAttribute(text)}"`;
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
export function mergeAttributes(parts: Record<string, unknown>[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const part of parts) {
    for (const [name, value] of Object.entries(part ?? {})) {
      result[name] =
        name === 'class' && result.class !== undefined && value !== undefined
          ? [result.class, value]
          : value;
    }
  }
  return result;
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
 * the method attribute to add, if the element has none.
 */
export function actionAttributes(
  prefix: string,
  name: string,
  id: string,
  method?: string,
  result?: string,
): string {
  const methodText = method ? ` ${method}="post"` : '';
  if (result !== undefined) {
    // The form posts to its page, which renders with the result. With the
    // loader, the result is written into the `$action` at `result` instead.
    return ` ${name}="?__action=${encodeURIComponent(id)}"${methodText} b-action="${escapeAttribute(id)}" b-result="${escapeAttribute(result)}"`;
  }
  const url = `${prefix}/${encodeURIComponent(id)}`;
  return ` ${name}="${escapeAttribute(url)}"${methodText}`;
}
