// Finds where whole nodes end in markup that arrives in pieces.

const VOID = new Set([
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
 * The end of the last whole node at the top level of markup that streams in,
 * so a chunk that ends inside a tag, the text of a script or a template
 * waits for the rest. A `>` in an attribute or a script does not end a node.
 */
export function wholeNodes(markup: string): number {
  const tag = /<(\/?)([a-zA-Z][\w-]*)(?:[^>"']|"[^"]*"|'[^']*')*>/g;
  const lower = markup.toLowerCase();
  let depth = 0;
  let end = 0;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(markup))) {
    const [whole, closing, name] = match;
    const element = name!.toLowerCase();
    if (!closing && element === 'script') {
      // The text of a script is not markup, and ends only at `</script`.
      const close = lower.indexOf('</script', tag.lastIndex);
      const after = close < 0 ? -1 : markup.indexOf('>', close);
      if (after < 0) {
        return end;
      }
      tag.lastIndex = after + 1;
    } else if (!VOID.has(element) && !whole.endsWith('/>')) {
      depth += closing ? -1 : 1;
    }
    if (depth === 0) {
      end = tag.lastIndex;
    }
  }
  return end;
}
