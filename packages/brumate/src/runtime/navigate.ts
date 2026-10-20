// Client navigation. The loader imports it on the first navigation, so pages
// that never navigate do not load it.

export interface Visit {
  url: string;
  /** For a form that posts to a server function. */
  init?: RequestInit;
  /** False for the back and forward buttons, which already changed the history. */
  push: boolean;
  /**
   * Runs before the new page replaces the old one. `partial` is true when
   * the page keeps its layouts and replaces only some routes.
   */
  leave: (partial: boolean) => Promise<void>;
  /** Runs after the first render of the new page is in the document. */
  enter: () => void;
}

let controller: AbortController | undefined;

const STATE = 'script[type="brumate/state"]';

/** A route slot in the page, between `<!--R…-->` and `<!--/R-->`. */
interface Region {
  /** The scope of the layout that renders the slot. */
  layout: number;
  name: string;
  /** The scope of the route in the slot. */
  root: number;
  key: string;
  start: Comment;
  end: Comment;
  children: Region[];
}

/** Finds the route slots in a document, nested as the routes are. */
function regions(root: Node): Region[] {
  const top: Region[] = [];
  const stack: Region[] = [];
  const walker = (root.ownerDocument ?? (root as Document)).createTreeWalker(root, 128);
  for (
    let node = walker.nextNode() as Comment | null;
    node;
    node = walker.nextNode() as Comment | null
  ) {
    const match = /^R(-?\d+):([^:]+):(\d+):(.*)$/.exec(node.data);
    if (match) {
      const region: Region = {
        layout: Number(match[1]),
        name: match[2]!,
        root: Number(match[3]),
        key: decodeURIComponent(match[4]!),
        start: node,
        end: node,
        children: [],
      };
      (stack.at(-1)?.children ?? top).push(region);
      stack.push(region);
    } else if (node.data === '/R' && stack.length > 0) {
      stack.pop()!.end = node;
    }
  }
  return top;
}

interface Plan {
  /** Old slots and the new slots that replace them. */
  replace: [Region, Region][];
  alias: Map<number, number>;
}

/**
 * Pairs the slots of the old and the new page by name. A layout with the
 * same key stays, and its slots are compared in turn. Any other route is
 * replaced. Returns undefined when the pages do not line up.
 */
function plan(old: Region[], next: Region[], result: Plan): Plan | undefined {
  for (const region of next) {
    const before = old.find((item) => item.name === region.name);
    if (!before) {
      return undefined;
    }
    result.alias.set(region.layout, before.layout);
    if (before.key === region.key && region.children.length > 0) {
      // The layout stays, so its new scope stands for the old one.
      result.alias.set(region.root, before.root);
      if (!plan(before.children, region.children, result)) {
        return undefined;
      }
    } else {
      result.replace.push([before, region]);
    }
  }
  return result;
}

function between(start: Node, end: Node): Node[] {
  const nodes = [start];
  for (let node = start.nextSibling; node && nodes.at(-1) !== end; node = node.nextSibling) {
    nodes.push(node);
  }
  return nodes;
}

/** True when a slot's end comment is a sibling of its start comment. */
function complete(region: Region): boolean {
  return between(region.start, region.end).at(-1) === region.end;
}

/**
 * Plans to replace only the routes that change, when the new page has the
 * same root route as the current one. Returns undefined when it cannot.
 */
function planRoutes(next: Document): Plan | undefined {
  const scripts = document.querySelectorAll(`${STATE}[data-route]`);
  const route = scripts[scripts.length - 1]?.getAttribute('data-route');
  const state = next.body.querySelector(`${STATE}[data-route]`);
  if (!route || state?.getAttribute('data-route') !== route) {
    return undefined;
  }
  const result = plan(regions(document.body), regions(next.body), {
    replace: [],
    alias: new Map(),
  });
  if (
    !result ||
    result.replace.length === 0 ||
    !result.replace.every(([before, region]) => complete(before) && complete(region))
  ) {
    return undefined;
  }
  return result;
}

/** Replaces the routes that change, and keeps the rest of the page. */
function replaceRoutes(next: Document, result: Plan): void {
  const state = next.body.querySelector(`${STATE}[data-route]`)!;
  for (const [before, region] of result.replace) {
    const nodes = between(before.start, before.end);
    const parent = before.start.parentNode!;
    for (const node of between(region.start, region.end)) {
      parent.insertBefore(document.adoptNode(node), before.start);
    }
    for (const node of nodes) {
      node.parentNode?.removeChild(node);
    }
  }
  // The core drops the scopes of the old routes, and adds only the scopes of the new ones.
  state.setAttribute('data-drop', result.replace.map(([before]) => before.root).join(','));
  state.setAttribute('data-roots', result.replace.map(([, region]) => region.root).join(','));
  state.setAttribute(
    'data-alias',
    [...result.alias].map(([from, to]) => `${from}:${to}`).join(','),
  );
  for (const script of next.body.querySelectorAll(STATE)) {
    document.body.append(document.adoptNode(script));
  }
}

/** A number above every scope and boundary ID in the page, for the server to start the next page at. */
function base(): number {
  let value = 0;
  for (const script of document.querySelectorAll(`${STATE}[data-next]`)) {
    value = Math.max(value, Number(script.getAttribute('data-next')));
  }
  return value;
}

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
    const headers = new Headers(visit.init?.headers);
    headers.set('x-brumate-base', String(base()));
    response = await fetch(visit.url, { ...visit.init, headers, signal: current.signal });
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
  // A link keeps the layouts that stay the same. A form replaces the whole page,
  // because what it changed can show anywhere on it.
  const routes = visit.init ? undefined : planRoutes(next);
  await visit.leave(routes !== undefined);
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
  if (routes) {
    replaceRoutes(next, routes);
  } else {
    document.body.replaceWith(document.adoptNode(next.body));
  }
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
