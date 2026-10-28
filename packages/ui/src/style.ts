/** A `style` prop of an object: camel case keys, or custom properties such as `--size`. */
export type StyleObject = Record<string, string | number | false | null | undefined>;

function kebab(name: string): string {
  return name.startsWith('--') ? name : name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/** The text of a `style` prop that is a string, an object or missing. */
function styleText(style: unknown): string {
  if (typeof style === 'object' && style !== null) {
    const parts: string[] = [];
    for (const [name, value] of Object.entries(style)) {
      if (value !== null && value !== undefined && value !== false) {
        parts.push(`${kebab(name)}:${String(value)}`);
      }
    }
    return parts.join(';');
  }
  return style === null || style === undefined || style === false ? '' : String(style);
}

/**
 * Puts the style of a part before the `style` prop of the user, so a spread of the props keeps
 * both. The prop can be a string, an object or missing. No style at all is undefined.
 */
export function mergeStyle(own: string | undefined, style: unknown): string | undefined {
  const text = styleText(style).replace(/^[\s;]+/, '');
  if (!own) {
    return text || undefined;
  }
  if (!text) {
    return own;
  }
  return `${own.replace(/[\s;]+$/, '')};${text}`;
}
