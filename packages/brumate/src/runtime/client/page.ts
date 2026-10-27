// Parts of the page outside a component: style variables, `#head` and `#portal` markup,
// stylesheets and `#defer` in the browser.

import { insertHTML } from './insert.ts';
import { afterInsert } from './scopes.ts';
import { DEV } from './state.ts';
import type { Scope } from './state.ts';

/** Sets a style variable on the top-level elements of a component instance. */
export function setVar(scope: Scope, name: string, value: unknown): void {
  const css = value === null || value === undefined || value === false ? '' : String(value);
  for (const element of document.querySelectorAll<HTMLElement>(`[b-v="${scope.id}"]`)) {
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
