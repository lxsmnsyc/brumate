// Keeps `document.title` in step with the `<title>` elements of markup.

import { HAS_TITLES } from '../features.ts';

/** Sets the title of the page. */
export function title(value: unknown): void {
  setTitle(value === null || value === undefined ? '' : String(value));
}

/**
 * Sets `document.title`, which writes the first `<title>` of the document.
 * The head gets a `<title>` of its own first, so a `<title>` in markup keeps its text.
 */
function setTitle(text: string): void {
  if (!document.head.querySelector('title:not([b-t])')) {
    document.head.prepend(document.createElement('title'));
  }
  document.title = text;
}

/** Watches the `<title>` elements of markup, once one is in the page. */
let titleObserver: MutationObserver | undefined;

const PAGE_TITLE = 'title[b-t]';

/** True when a node is or holds a `<title>` of markup. */
function holdsTitle(node: Node): boolean {
  return node instanceof Element && (node.matches(PAGE_TITLE) || !!node.querySelector(PAGE_TITLE));
}

/** Gives the page the text of its last `<title>` in markup. Without one, the title stays. */
function syncTitle(): void {
  const titles = document.querySelectorAll(PAGE_TITLE);
  const last = titles[titles.length - 1];
  if (last && document.title !== last.textContent) {
    setTitle(last.textContent ?? '');
  }
}

function hasTitle(nodes: NodeList): boolean {
  for (const node of nodes) {
    if (holdsTitle(node)) {
      return true;
    }
  }
  return false;
}

/**
 * Starts to follow the `<title>` elements of markup, when `root` has one. A
 * block that adds or removes one, or a change of its text, sets the title.
 */
export function watchTitles(root: ParentNode): void {
  if (!HAS_TITLES || titleObserver || !root.querySelector(PAGE_TITLE)) {
    return;
  }
  titleObserver = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (
        target?.closest(PAGE_TITLE) ||
        hasTitle(record.addedNodes) ||
        hasTitle(record.removedNodes)
      ) {
        syncTitle();
        return;
      }
    }
  });
  titleObserver.observe(document, { childList: true, subtree: true, characterData: true });
}
