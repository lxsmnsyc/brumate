// Parts of the page outside a component: style variables, `#head` and `#portal` markup,
// stylesheets and `#defer` in the browser.

import { insertHTML } from './insert.ts';
import { afterInsert } from './scopes.ts';
import { DEV } from './state.ts';
import type { Scope } from './state.ts';

/** The elements that carry each ID in `b-v`, built from one pass over the page. */
let carriers: Map<string, Element[]> | undefined;
let watcher: MutationObserver | undefined;

/** The elements of a scope. The index is rebuilt after the page adds, removes or marks elements. */
function carriersOf(id: number | string): Element[] {
  // The observer drops the index; `takeRecords` sees the changes that it has not reported yet.
  watcher ??= new MutationObserver(() => {
    carriers = undefined;
  });
  if (!carriers || watcher.takeRecords().length > 0) {
    carriers = new Map();
    watcher.disconnect();
    watcher.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['b-v'],
    });
    for (const element of document.querySelectorAll('[b-v]')) {
      for (const token of element.getAttribute('b-v')!.split(' ')) {
        const list = carriers.get(token);
        if (list) {
          list.push(element);
        } else {
          carriers.set(token, [element]);
        }
      }
    }
  }
  return carriers.get(String(id)) ?? [];
}

/**
 * Sets a style variable on the top-level elements of a component or block instance. `b-v` lists
 * the IDs of the instances whose variables an element carries, since an element at the top level
 * of a block inside another carries both.
 */
export function setVar(scope: Scope, name: string, value: unknown): void {
  const css = value === null || value === undefined || value === false ? '' : String(value);
  for (const element of carriersOf(scope.id) as HTMLElement[]) {
    if (element.style.getPropertyValue(name) !== css) {
      element.style.setProperty(name, css);
    }
  }
}

/**
 * Warns in development that the browser renders a `#defer` block of a
 * component, such as inside a `#client` body of its parent. Only the server
 * renders the body, so the fallback stays.
 */
export function deferInBrowser(id: string): void {
  if (DEV) {
    console.warn(
      `${id} renders a #defer block in the browser, so it shows its fallback only. Render the component in markup that the server renders.`,
    );
  }
}

/** Adds the markup of a `#head` block to the document's head. */
export function addHead(html: string | DocumentFragment): void {
  afterInsert.push(() => insertHTML({ parent: document.head }, html));
}

/** Adds the markup of a `#portal` block at the end of the page, after the markup around it. */
export function addPortal(html: string | DocumentFragment): void {
  afterInsert.push(() => insertHTML({ parent: document.body }, html));
}

/** Adds a component's stylesheet to the page, if the server did not. */
export function addStyle(id: string, css: string): string {
  if (!document.querySelector(`style[b-style="${id}"]`)) {
    const sheet = document.createElement('style');
    sheet.setAttribute('b-style', id);
    sheet.textContent = css;
    document.head.append(sheet);
  }
  return '';
}
