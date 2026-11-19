// Stylesheet links that a page swaps in: loading them before the swap, and telling which ones a
// page still needs. Client navigation and the body of a `#defer` block share it.

/** A stylesheet link. */
export const SHEET = 'link[rel~="stylesheet"][href]';

/** How long a swap waits for a stylesheet, in milliseconds. A stylesheet that is slower shows late. */
export const WAIT = 4000;

/** The URL of a stylesheet link, which is what makes two links the same stylesheet. */
export function sheetKey(link: Element): string {
  return new URL(link.getAttribute('href')!, location.href).href;
}

/** True when a stylesheet link of the page, other than those in `ignore`, has this URL. */
export function hasSheet(key: string, ignore?: ReadonlySet<Element>): boolean {
  for (const link of document.querySelectorAll(SHEET)) {
    if (link.isConnected && !ignore?.has(link) && sheetKey(link) === key) {
      return true;
    }
  }
  return false;
}

/** The stylesheet links of a tree, including those in the content of its `<template>` elements. */
export function findSheets(root: ParentNode): Element[] {
  const found = [...root.querySelectorAll(SHEET)];
  for (const template of root.querySelectorAll('template')) {
    found.push(...findSheets(template.content));
  }
  return found;
}

/**
 * Loads the stylesheets that a tree of markup links and the page does not have yet, so they are in
 * the cache when the markup comes in and no frame shows it unstyled. It waits for each one to load
 * or fail, and stops waiting after a few seconds, or when the signal aborts. The links that the
 * page has stay: a URL loads once.
 */
export async function preloadSheets(root: ParentNode, signal?: AbortSignal): Promise<void> {
  const waits: Promise<void>[] = [];
  const started = new Set<string>();
  const added: HTMLLinkElement[] = [];
  for (const link of findSheets(root)) {
    const key = sheetKey(link);
    if (started.has(key) || hasSheet(key)) {
      continue;
    }
    started.add(key);
    const preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'style';
    preload.href = key;
    // The attribute of the parsed page: browsers hide it, and the policy checks the nonce.
    const nonce = link.getAttribute('nonce');
    if (nonce) {
      preload.setAttribute('nonce', nonce);
    }
    waits.push(
      new Promise<void>((resolve) => {
        preload.onload = preload.onerror = () => resolve();
      }),
    );
    added.push(preload);
    document.head.append(preload);
  }
  if (added.length === 0) {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stop: (() => void) | undefined;
  try {
    await Promise.race([
      Promise.all(waits),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, WAIT);
      }),
      new Promise<void>((resolve) => {
        stop = () => resolve();
        signal?.addEventListener('abort', stop, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (stop) {
      signal?.removeEventListener('abort', stop);
    }
    for (const preload of added) {
      preload.remove();
    }
  }
}

/** The scopes (`b-c-<hash>`) that the rules of a loaded stylesheet use, by link. */
export const scopes: WeakMap<Element, string[]> = new WeakMap();

/** The scope attributes of a stylesheet, or none when it is not loaded or cannot be read. */
export function scopesOf(link: HTMLLinkElement): string[] {
  let found = scopes.get(link);
  if (!found) {
    found = [];
    try {
      const names = new Set<string>();
      for (const rule of link.sheet ? Array.from(link.sheet.cssRules) : []) {
        for (const name of rule.cssText.match(/b-c-[\w-]+/g) ?? []) {
          names.add(name);
        }
      }
      found = [...names];
    } catch {
      // A stylesheet of another origin without CORS cannot be read.
    }
    // Only a loaded sheet is remembered.
    if (link.sheet) {
      scopes.set(link, found);
    }
  }
  return found;
}

/** True when an element of the page uses one of the scopes. No scopes means a global stylesheet. */
export function inUse(names: string[]): boolean {
  if (names.length === 0) {
    return true;
  }
  for (const name of names) {
    if (document.querySelector(`[${name}]`)) {
      return true;
    }
  }
  return false;
}
