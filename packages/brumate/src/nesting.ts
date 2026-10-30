import type { Body, ComponentNode, Markup, Range, SFCFile } from './ast.ts';

/**
 * Elements whose start tag closes an open `<p>`, from the "in body" insertion mode of the HTML
 * spec. `table` is left out, since only a document in quirks mode keeps the `<p>` open.
 */
const CLOSES_P = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'center',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dd',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hgroup',
  'hr',
  'li',
  'listing',
  'main',
  'menu',
  'nav',
  'ol',
  'p',
  'pre',
  'search',
  'section',
  'summary',
  'ul',
  'xmp',
]);

/** Elements that end the "button scope": a `<p>` above one of them stays open. */
const BUTTON_SCOPE = new Set([
  'applet',
  'button',
  'caption',
  'html',
  'marquee',
  'object',
  'table',
  'td',
  'template',
  'th',
]);

/** Elements that end the list of open `<a>` elements. */
const LINK_MARKERS = new Set(['applet', 'caption', 'marquee', 'object', 'template', 'td', 'th']);

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/** What a table, its sections and its rows hold. Anything else moves out of the table. */
const TABLE_CHILDREN: Record<string, ReadonlySet<string>> = {
  table: new Set([
    'caption',
    'col',
    'colgroup',
    'form',
    'input',
    'script',
    'style',
    'tbody',
    'td',
    'template',
    'tfoot',
    'th',
    'thead',
    'tr',
  ]),
  tbody: new Set(['form', 'input', 'script', 'style', 'td', 'template', 'th', 'tr']),
  thead: new Set(['form', 'input', 'script', 'style', 'td', 'template', 'th', 'tr']),
  tfoot: new Set(['form', 'input', 'script', 'style', 'td', 'template', 'th', 'tr']),
  tr: new Set(['form', 'input', 'script', 'style', 'td', 'template', 'th']),
};

/** True when a `<p>` is open in button scope in `open`, the tags above an element. */
function paragraphOpen(open: readonly string[]): boolean {
  for (let index = open.length - 1; index >= 0; index--) {
    if (open[index] === 'p') {
      return true;
    }
    if (BUTTON_SCOPE.has(open[index]!)) {
      return false;
    }
  }
  return false;
}

/**
 * The tag in `open`, the tags above an element with the nearest last, that the HTML parser closes
 * or moves the element out of, or undefined. The rules come from the HTML spec and are the ones
 * that hold in every document. The parser keeps a document in standard mode, so the same
 * markup parses the same way everywhere.
 */
export function nestingProblem(open: readonly string[], tag: string): string | undefined {
  // Inside `<svg>` and `<math>` the parser follows other rules.
  if (open.includes('svg') || open.includes('math')) {
    return undefined;
  }
  const parent = open[open.length - 1];
  if (CLOSES_P.has(tag) && paragraphOpen(open)) {
    return 'p';
  }
  if (parent !== undefined) {
    // `<h1><h2>` closes the first heading. `<li><li>` and `<dd><dt>` close the item.
    if (HEADINGS.has(parent) && HEADINGS.has(tag)) {
      return parent;
    }
    if (parent === 'li' && tag === 'li') {
      return parent;
    }
    if ((parent === 'dd' || parent === 'dt') && (tag === 'dd' || tag === 'dt')) {
      return parent;
    }
    const allowed = TABLE_CHILDREN[parent];
    if (allowed && !allowed.has(tag)) {
      return parent;
    }
  }
  // `<a>` inside `<a>` splits the link. `<form>` inside `<form>` is dropped. `<button>` inside
  // `<button>` closes the first.
  if (tag === 'a') {
    for (let index = open.length - 1; index >= 0; index--) {
      if (open[index] === 'a') {
        return 'a';
      }
      if (LINK_MARKERS.has(open[index]!)) {
        break;
      }
    }
  }
  if (tag === 'form') {
    for (let index = open.length - 1; index >= 0; index--) {
      if (open[index] === 'form') {
        return 'form';
      }
      if (open[index] === 'template') {
        break;
      }
    }
  }
  if (tag === 'button') {
    for (let index = open.length - 1; index >= 0; index--) {
      if (open[index] === 'button') {
        return 'button';
      }
      if (BUTTON_SCOPE.has(open[index]!)) {
        break;
      }
    }
  }
  return undefined;
}

/** The message of BRM185. */
export function nestingMessage(tag: string, parent: string): string {
  return `<${tag}> cannot be inside <${parent}>: the HTML parser closes or moves it before the page runs. Move it out of the <${parent}>, or use a <span> or as="span"`;
}

/** Walks the markup of a file, with the tags that are open above each node. */
function walk(
  file: SFCFile,
  onElement: (tag: string, open: string[], node: Range) => void,
  onComponent: (node: ComponentNode, open: string[]) => void,
): void {
  function body(content: Body | undefined, open: string[]): void {
    if (!content) {
      return;
    }
    for (const template of content.templates) {
      body(template.body, []);
    }
    nodes(content.children, open);
  }

  function nodes(list: Markup[], open: string[]): void {
    for (const node of list) {
      visit(node, open);
    }
  }

  function visit(node: Markup, open: string[]): void {
    switch (node.kind) {
      case 'element': {
        const tag = node.tag.toLowerCase();
        onElement(tag, open, node);
        open.push(tag);
        nodes(node.children, open);
        open.pop();
        return;
      }
      case 'component':
        onComponent(node, open);
        // Children render where the component puts them.
        nodes(node.children, []);
        return;
      case 'dynamic':
        // The tag is not known.
        nodes(node.children, []);
        return;
      case 'fragment':
        nodes(node.children, open);
        return;
      case 'if':
        for (const branch of node.branches) {
          body(branch.body, open);
        }
        body(node.fallback, open);
        return;
      case 'switch':
        for (const branch of node.cases) {
          body(branch.body, open);
        }
        body(node.fallback, open);
        return;
      case 'for':
      case 'repeat':
      case 'loading':
      case 'client':
      case 'defer':
      case 'try':
        body(node.body, open);
        body(node.fallback, open);
        return;
      case 'key':
        body(node.body, open);
        return;
      case 'portal':
      case 'head':
      case 'offscreen':
        // These render somewhere else, or in an element that is not known.
        body(node.body, []);
        return;
      default:
        return;
    }
  }

  for (const template of file.templates) {
    body(template.body, []);
  }
  nodes(file.children, []);
}

/** Reports each element that the HTML parser closes or moves, as BRM185. */
export function checkNesting(file: SFCFile, report: (message: string, at: Range) => void): void {
  walk(
    file,
    (tag, open, node) => {
      const parent = nestingProblem(open, tag);
      if (parent !== undefined) {
        report(nestingMessage(tag, parent), node);
      }
    },
    () => {},
  );
}

/** The components that sit inside a `<p>`, which the server checks in development. */
export function paragraphComponents(file: SFCFile): Set<ComponentNode> {
  const found = new Set<ComponentNode>();
  walk(
    file,
    () => {},
    (node, open) => {
      if (!open.includes('svg') && !open.includes('math') && paragraphOpen(open)) {
        found.add(node);
      }
    },
  );
  return found;
}

/** The tag that the HTML starts with, skipping comments, or undefined. */
export function firstTag(html: string): string | undefined {
  return /^(?:\s|<!--[^>]*?-->)*<([a-z][a-z0-9-]*)/i.exec(html)?.[1]?.toLowerCase();
}

/** True when a start tag of `tag` closes an open `<p>`. */
export function closesParagraph(tag: string): boolean {
  return CLOSES_P.has(tag);
}
