// Loads the body of a `#defer` block. The loader imports this module when
// the block's trigger fires, so a page without `#defer` does not load it.
//
// The server renders the route again for the request and answers with what
// it streams for a `#loading` body that is ready: the body in a
// `<template b-l>`, the script that swaps it in, and its state records.
// This module adds that markup to the page and runs its scripts, in order.

import { build, skew } from './client.ts';
import { trustedHTML, trustedScript } from './trusted.ts';
/** The nonce of a script. Browsers hide the attribute once the page loads, and keep the property. */
function nonceOf(script: HTMLScriptElement): string | null {
  return script.nonce || script.getAttribute('nonce');
}

/** The Content Security Policy nonce of the page, which the scripts of the answer need to run. */
function pageNonce(): string | undefined {
  for (const script of document.querySelectorAll('script')) {
    const nonce = nonceOf(script);
    if (nonce) {
      return nonce;
    }
  }
  return undefined;
}

/** The templates whose bodies were asked for. */
const requested = new WeakSet<Element>();

/**
 * Asks the server for the body of the `#defer` block of a `<template
 * b-defer>`, and puts it in place of the fallback. When the server cannot
 * render it, such as a page that changed since it loaded, or a static host
 * that answers with the whole page, the fallback stays.
 */
export async function loadDeferred(template: Element): Promise<void> {
  // Once, so the devtools can fire the trigger before the loader does.
  if (requested.has(template)) {
    return;
  }
  requested.add(template);
  const [, boundary, base] = template.getAttribute('b-defer')!.split(':') as [
    string,
    string,
    string,
  ];
  const response = await fetch(location.href, {
    headers: {
      'x-brumate-defer': `${boundary} ${template.getAttribute('b-b')}`,
      'x-brumate-base': base,
      ...(build === undefined ? {} : { 'x-brumate-build': build }),
    },
  });
  if (response.status === 409 && response.headers.get('x-brumate-build')) {
    // The site changed since the page loaded. The fallback stays, and the next page loads in full.
    skew('defer');
    return;
  }
  if (!response.ok || response.headers.get('x-brumate-defer') !== boundary) {
    return;
  }
  const parsed = document.createElement('template');
  parsed.innerHTML = trustedHTML(await response.text());
  const nonce = pageNonce();
  // A copy, because appending moves nodes out of the live list.
  for (const node of Array.from(parsed.content.childNodes)) {
    if (node.nodeName !== 'SCRIPT') {
      document.body.append(node);
      continue;
    }
    // A script from `innerHTML` does not run, so a copy goes in its place.
    const script = node as HTMLScriptElement;
    const copy = document.createElement('script');
    for (const attribute of script.attributes) {
      if (attribute.name !== 'nonce') {
        copy.setAttribute(attribute.name, attribute.value);
      }
    }
    if (nonce) {
      copy.nonce = nonce;
    }
    copy.textContent = trustedScript(script.textContent ?? '');
    document.body.append(copy);
  }
}
