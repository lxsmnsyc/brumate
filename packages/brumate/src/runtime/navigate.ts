// Client navigation. The loader imports it on the first navigation, so pages
// that never navigate do not load it.

export interface Visit {
  url: string;
  /** For a form that posts to a server function. */
  init?: RequestInit;
  /** False for the back and forward buttons, which already changed the history. */
  push: boolean;
  /** Runs before the new page replaces the old one. */
  leave: () => Promise<void>;
  /** Runs after the first render of the new page is in the document. */
  enter: () => void;
}

let controller: AbortController | undefined;

/** Copies a script, so the browser runs it. Scripts from a parser that has no window do not run. */
function runnable(script: HTMLScriptElement): HTMLScriptElement {
  const copy = document.createElement('script');
  for (const attribute of script.attributes) {
    copy.setAttribute(attribute.name, attribute.value);
  }
  copy.nonce = script.nonce;
  copy.textContent = script.textContent;
  return copy;
}

/** Moves nodes into the body. Inline scripts, such as the ones that swap in `#loading` bodies, run. */
function append(nodes: Node[]): void {
  for (const node of nodes) {
    const adopted = document.adoptNode(node);
    const scripts =
      adopted.nodeType === 1
        ? [
            ...((adopted as Element).matches('script') ? [adopted as HTMLScriptElement] : []),
            ...(adopted as Element).querySelectorAll('script'),
          ]
        : [];
    document.body.append(adopted);
    for (const script of scripts) {
      if (
        !script.src &&
        (!script.type || script.type === 'text/javascript' || script.type === 'module')
      ) {
        script.replaceWith(runnable(script));
      }
    }
  }
}

/** Makes the head of the page match the new one, keeping elements that are in both. */
function updateHead(next: Document): void {
  const keep = new Map<string, Element>();
  for (const element of document.head.children) {
    keep.set(element.outerHTML, element);
  }
  // A copy, because adopting an element removes it from the live list.
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const element of [...next.head.children]) {
    const html = element.outerHTML;
    if (keep.has(html)) {
      keep.delete(html);
    } else {
      document.head.append(document.adoptNode(element));
    }
  }
  for (const element of keep.values()) {
    // Module scripts stay, because removing them does not unload them.
    if (!(element.tagName === 'SCRIPT' && (element as HTMLScriptElement).src)) {
      element.remove();
    }
  }
}

function scroll(url: URL, saved: number | undefined): void {
  if (saved !== undefined) {
    window.scrollTo(0, saved);
    return;
  }
  const target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
  if (target) {
    target.scrollIntoView();
  } else {
    window.scrollTo(0, 0);
  }
}

/**
 * Loads a page and replaces the current one with it. The first render of the
 * page replaces the document as soon as it arrives. Markup that the server
 * streams after it, such as `#loading` bodies, follows as it arrives.
 */
export async function navigate(visit: Visit): Promise<void> {
  controller?.abort();
  const current = new AbortController();
  controller = current;
  // The scroll position of the page that is left, for the back button.
  history.replaceState({ ...history.state, scroll: window.scrollY }, '');
  let response: Response;
  try {
    response = await fetch(visit.url, { ...visit.init, signal: current.signal });
  } catch (error) {
    if (!current.signal.aborted) {
      location.assign(visit.url);
    }
    throw error;
  }
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('text/html') || !response.body) {
    if (!visit.init) {
      // Not a page, such as a file. The browser opens it.
      location.assign(visit.url);
      return;
    }
    // The error of a form post, which a browser without scripts shows as text.
    const text = await response.text();
    response = new Response(
      `<!doctype html><pre>${text.replace(/[&<]/g, (char) => (char === '&' ? '&amp;' : '&lt;'))}</pre>`,
    );
  }
  const url = new URL(response.url || visit.url, location.href);
  url.hash = new URL(visit.url, location.href).hash;
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();

  // The first render ends with </html>. What comes after it streams in later.
  let text = '';
  let end = -1;
  while (end === -1) {
    // oxlint-disable-next-line no-await-in-loop -- Chunks arrive in order.
    const chunk = await reader.read();
    if (current.signal.aborted) {
      return;
    }
    if (chunk.done) {
      end = text.length;
      break;
    }
    text += chunk.value;
    const index = text.search(/<\/html\s*>/i);
    if (index !== -1) {
      end = index + text.slice(index).indexOf('>') + 1;
    }
  }
  const next = new DOMParser().parseFromString(text.slice(0, end), 'text/html');
  await visit.leave();
  if (current.signal.aborted) {
    return;
  }
  // A copy, because removing an attribute changes the live list.
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const attribute of [...document.documentElement.attributes]) {
    document.documentElement.removeAttribute(attribute.name);
  }
  for (const attribute of next.documentElement.attributes) {
    document.documentElement.setAttribute(attribute.name, attribute.value);
  }
  // Read before the head moves, because moving the <title> clears it in `next`.
  const title = next.title;
  updateHead(next);
  document.title = title;
  const same = url.href === location.href;
  const top = window.scrollY;
  document.body.replaceWith(document.adoptNode(next.body));
  // A link to the page itself, or a form that comes back to it, does not add to the history.
  if (visit.push && !same) {
    history.pushState({}, '', url);
  } else if (!same) {
    history.replaceState(history.state, '', url);
  }
  visit.enter();
  if (visit.init && same) {
    // A form that comes back to its page keeps the place on the page.
    window.scrollTo(0, top);
  } else {
    scroll(url, visit.push ? undefined : (history.state?.scroll as number | undefined));
  }

  // Later markup is parsed in a document without a window, so it can arrive
  // in any pieces. A node is complete once the parser has moved past it.
  const sink = document.implementation.createHTMLDocument('');
  sink.open();
  sink.write('<!doctype html><body>');
  let rest = text.slice(end);
  for (;;) {
    if (rest) {
      sink.write(rest);
      append([...sink.body.childNodes].slice(0, -1));
    }
    // oxlint-disable-next-line no-await-in-loop -- Chunks arrive in order.
    const chunk = await reader.read();
    if (current.signal.aborted) {
      return;
    }
    if (chunk.done) {
      break;
    }
    rest = chunk.value;
  }
  sink.close();
  append([...sink.body.childNodes]);
}
