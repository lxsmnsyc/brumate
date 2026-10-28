import { attributeText } from 'brumate/html';

/**
 * Puts the `style` prop of the user before the style of a part, so a spread of the props keeps
 * both, and the essential properties of the part, such as `position` or `--percentage`, win. The
 * prop can be a string, an object or missing. No style at all is undefined.
 */
export function mergeStyle(style: unknown, own: string | undefined): string | undefined {
  const text = (attributeText('style', style) ?? '').replace(/[\s;]+$/, '').replace(/^[\s;]+/, '');
  if (!own) {
    return text || undefined;
  }
  return text ? `${text};${own}` : own;
}
