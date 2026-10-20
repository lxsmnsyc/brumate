// HTML string helpers that the server and the client both use.

const RAW: unique symbol = Symbol.for('brumate.raw');

/** HTML that is inserted as it is, such as the output of a template. */
export interface Raw {
  [RAW]: string;
}

export function raw(html: string): Raw {
  return { [RAW]: html };
}

export function isRaw(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && RAW in value;
}

export function rawHTML(value: Raw): string {
  return value[RAW];
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

export function escape(value: string): string {
  return value.replace(/[&<>]/g, (char) => ESCAPES[char]!);
}

export function escapeAttribute(value: string): string {
  return value.replace(/[&<"]/g, (char) => ESCAPES[char]!);
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

function toKebabCase(name: string): string {
  return name.startsWith('--') ? name : name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function classValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(classValue).filter(Boolean).join(' ');
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)
      .join(' ');
  }
  return value ? String(value) : '';
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
  return `<style data-brm="${escapeAttribute(id)}">${css.replace(/<\/style/gi, '<\\/style')}</style>`;
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
): string {
  const url = `${prefix}/${encodeURIComponent(id)}`;
  return ` ${name}="${escapeAttribute(url)}"${method ? ` ${method}="post"` : ''}`;
}
