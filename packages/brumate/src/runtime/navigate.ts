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
  /** Swaps the page inside a view transition, where the browser has them. */
  transition?: boolean;
}

/**
 * Runs `update` inside a view transition, with a type that tells how the page
 * was reached: `push` for a link, `traverse` for the back and forward
 * buttons, and `form` for a form. Without transitions, it runs `update`.
 */
async function transition(visit: Visit, update: () => void): Promise<void> {
  if (!visit.transition || typeof document.startViewTransition !== 'function') {
    update();
    return;
  }
  const types = [visit.init ? 'form' : visit.push ? 'push' : 'traverse'];
  // Browsers that have transitions without types take only a callback.
  const started =
    typeof ViewTransition !== 'undefined' && 'types' in ViewTransition.prototype
      ? document.startViewTransition({ update, types })
      : document.startViewTransition(update);
  await started.updateCallbackDone;
}

let controller: AbortController | undefined;

const STATE = 'script[data-state]';
const REGION = /^R(-?\d+):([^:]+):(\d+):(.*)$/;

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
    const match = REGION.exec(node.data);
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

/**
 * The server writes a component's stylesheet before its first instance, so
 * an old route can hold the stylesheet of a component that a kept layout
 * still shows. Such a stylesheet moves to the head. The others go with the
 * route, so the page keeps only the CSS of the components that it shows.
 */
function keepStyles(removed: HTMLStyleElement[]): void {
  for (const style of removed) {
    const id = style.getAttribute('data-brm')!;
    // The component ID ends with the hash that scopes its elements, as `s-<hash>`.
    const attribute = `s-${id.slice(id.lastIndexOf('_') + 1)}`;
    const present = document.querySelector(`style[data-brm="${CSS.escape(id)}"]`);
    if (!present && document.querySelector(`[${attribute}]`)) {
      document.head.append(style);
    }
  }
}

/**
 * True when a slot's end comment is a sibling of its start comment. The end
 * comes after the start in the document, so it then follows it.
 */
function complete(region: Region): boolean {
  return region.start.parentNode === region.end.parentNode;
}

/**
 * Plans to replace only the routes that change, when the new page has the
 * same root route as the current one. Returns undefined when it cannot.
 */
function planRoutes(next: Document, state: Element | null, requested: number): Plan | undefined {
  const scripts = document.querySelectorAll(`${STATE}[data-route]`);
  const route = scripts[scripts.length - 1]?.getAttribute('data-route');
  if (!route || state?.getAttribute('data-route') !== route) {
    return undefined;
  }
  // A page that did not start its IDs above this one, such as a static file that
  // ignores the request header, would mix its IDs with the kept layouts.
  if (state.getAttribute('data-root') !== String(requested)) {
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
function replaceRoutes(next: Document, state: Element, result: Plan): void {
  const removed: HTMLStyleElement[] = [];
  for (const [before, region] of result.replace) {
    const nodes = between(before.start, before.end);
    for (const node of nodes) {
      if (node.nodeType === 1) {
        const element = node as Element;
        if (element.matches('style[data-brm]')) {
          removed.push(element as HTMLStyleElement);
        }
        removed.push(...element.querySelectorAll<HTMLStyleElement>('style[data-brm]'));
      }
    }
    const parent = before.start.parentNode!;
    for (const node of between(region.start, region.end)) {
      parent.insertBefore(document.adoptNode(node), before.start);
    }
    for (const node of nodes) {
      node.parentNode?.removeChild(node);
    }
  }
  keepStyles(removed);
  // The core drops the scopes of the old routes, and adds only the scopes of the new ones.
  state.setAttribute('data-drop', result.replace.map(([before]) => before.root).join(','));
  state.setAttribute('data-roots', result.replace.map(([, region]) => region.root).join(','));
  state.setAttribute(
    'data-alias',
    [...result.alias].map(([from, to]) => `${from}:${to}`).join(','),
  );
  // The records run as they are added, after the IDs and these attributes are set.
  for (const script of next.body.querySelectorAll<HTMLScriptElement>(STATE)) {
    document.body.append(runnable(script));
  }
}

/** Moves the IDs of a page above the IDs of the page in the browser. */
interface Shift {
  /** The number to add to each scope and boundary ID. */
  by: number;
  /** The `data-root` of its state records, which keeps their references apart. */
  root: string;
}

/**
 * A page whose IDs do not start where this page asked, such as a prerendered
 * file on a static host, has its IDs moved before it is read. Returns
 * undefined when the server started them there.
 */
function shiftFor(state: Element | null, requested: number): Shift | undefined {
  if (!state) {
    return undefined;
  }
  const root = Number(state.getAttribute('data-root') ?? 0);
  return root === requested ? undefined : { by: requested - root, root: String(requested) };
}

const COMMENT_IDS = /^([tb])(\d+)(:.*)$|^([ilP])(\d+)$/;
/** Attributes that hold a scope ID, then `:` and more. */
const SCOPED = ['data-b', 'data-result'];
/** Attributes that hold only a scope or boundary ID. */
const IDS = ['data-v', 'data-l', 'data-h', 'data-next'];

/**
 * Adds a number to every scope and boundary ID in markup that the server
 * rendered: anchors, markers, swap scripts and state records. The core moves
 * the IDs inside a state record when it reads one with `data-offset`.
 */
function shiftIds(root: Node, shift: Shift): void {
  const add = (value: string): string => String(Number(value) + shift.by);
  const visit = (node: Node): void => {
    if (node.nodeType === 8) {
      const comment = node as Comment;
      const region = REGION.exec(comment.data);
      if (region) {
        const layout = Number(region[1]) < 0 ? region[1]! : add(region[1]!);
        comment.data = `R${layout}:${region[2]}:${add(region[3]!)}:${region[4]}`;
        return;
      }
      const match = COMMENT_IDS.exec(comment.data);
      if (match) {
        comment.data = match[1]
          ? `${match[1]}${add(match[2]!)}${match[3]}`
          : `${match[4]}${add(match[5]!)}`;
      }
      return;
    }
    if (node.nodeType !== 1) {
      return;
    }
    const element = node as Element;
    for (const name of SCOPED) {
      const value = element.getAttribute(name);
      if (value) {
        const [scope, rest] = value.split(':') as [string, string];
        element.setAttribute(name, `${add(scope)}:${rest}`);
      }
    }
    for (const name of IDS) {
      const value = element.getAttribute(name);
      if (value) {
        element.setAttribute(name, add(value));
      }
    }
    // Only a script can match the state selector, so other elements skip it. The text of a
    // record is not changed: the core moves the IDs in its value when it reads it.
    if (element.localName === 'script' && element.matches(STATE)) {
      element.setAttribute('data-offset', String(shift.by));
      element.setAttribute('data-root', shift.root);
    } else if (element.tagName === 'SCRIPT' && !element.hasAttribute('type')) {
      // The scripts that swap in `#loading` bodies and their head name the boundary.
      element.textContent = element.textContent!.replace(
        /\$b([SH])\((\d+)/g,
        (_, kind: string, id: string) => `$b${kind}(${add(id)}`,
      );
    }
    for (const child of element.tagName === 'TEMPLATE'
      ? (element as HTMLTemplateElement).content.childNodes
      : element.childNodes) {
      visit(child);
    }
  };
  visit(root);
}

/** A number above every scope and boundary ID in the page, for the server to start the next page at. */
function base(): number {
  let value = 0;
  for (const script of document.querySelectorAll(`${STATE}[data-next]`)) {
    value = Math.max(value, Number(script.getAttribute('data-next')));
  }
  return value;
}

/**
 * The Content Security Policy nonce of the page that the browser loaded.
 * Its policy stays for the whole visit, so scripts of later pages need it,
 * not the nonce of their own response. Read once, while a script holds it.
 */
let loadedNonce: string | undefined;

/** The nonce of a script. Browsers hide the attribute once the page loads, and keep the property. */
function nonceOf(script: HTMLScriptElement): string | null {
  return script.nonce || script.getAttribute('nonce');
}

function pageNonce(): string | undefined {
  for (const script of loadedNonce ? [] : document.querySelectorAll('script')) {
    loadedNonce = nonceOf(script) || undefined;
    if (loadedNonce) {
      break;
    }
  }
  return loadedNonce;
}

/** Copies a script, so the browser runs it. Scripts from a parser that has no window do not run. */
function runnable(script: HTMLScriptElement): HTMLScriptElement {
  const copy = document.createElement('script');
  for (const attribute of script.attributes) {
    if (attribute.name !== 'nonce') {
      copy.setAttribute(attribute.name, attribute.value);
    }
  }
  // A script that its server gave a nonce runs under the policy of the loaded page.
  const nonce = nonceOf(script);
  if (nonce) {
    copy.nonce = pageNonce() ?? nonce;
    // A DOM without the property, such as in tests, reads the attribute.
    copy.setAttribute('nonce', copy.nonce);
  }
  copy.textContent = script.textContent;
  return copy;
}

/** Moves nodes into the body. Inline scripts, such as the ones that swap in `#loading` bodies, run. */
function append(nodes: Node[], shift: Shift | undefined): void {
  for (const node of nodes) {
    if (shift) {
      shiftIds(node, shift);
    }
    const adopted = document.adoptNode(node);
    const scripts: HTMLScriptElement[] = [];
    if (adopted.nodeType === 1) {
      if ((adopted as Element).matches('script')) {
        scripts.push(adopted as HTMLScriptElement);
      }
      scripts.push(...(adopted as Element).querySelectorAll('script'));
    }
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
// Pages that a link started to load before its click, by URL without the hash.
const prefetched = new Map<
  string,
  { at: number; base: number; response: Promise<Response>; controller: AbortController }
>();

/** How long a page that loaded early is used, in milliseconds. */
const FRESH = 10_000;

/**
 * Starts loading a page before its link is clicked. A click within a few
 * seconds uses the response, so the page arrives sooner.
 */
export function prefetch(url: string): void {
  const key = url.split('#')[0]!;
  const entry = prefetched.get(key);
  if (entry && performance.now() - entry.at < FRESH) {
    return;
  }
  entry?.controller.abort();
  const requested = base();
  const loading = new AbortController();
  const response = fetch(key, {
    headers: { 'x-brumate-base': String(requested) },
    signal: loading.signal,
  });
  const next = { at: performance.now(), base: requested, response, controller: loading };
  // A failed load is not used. The click loads the page again.
  response.catch(() => {
    if (prefetched.get(key) === next) {
      prefetched.delete(key);
    }
  });
  prefetched.set(key, next);
}

/** Stops the pages that loaded early and were not used, so they free their connections. */
function clearPrefetched(): void {
  for (const entry of prefetched.values()) {
    entry.controller.abort();
  }
  prefetched.clear();
}

/** The response of a page that loaded early for these IDs, if it is still fresh. */
function takePrefetched(url: string, requested: number): Promise<Response> | undefined {
  const key = url.split('#')[0]!;
  const entry = prefetched.get(key);
  prefetched.delete(key);
  if (entry && entry.base === requested && performance.now() - entry.at < FRESH) {
    return entry.response;
  }
  entry?.controller.abort();
  return undefined;
}

// The end of the first render, which can be split across chunks.
const HTML_END = /<\/html\s*>/gi;

export async function navigate(visit: Visit): Promise<void> {
  // Read before the page changes, while the scripts of the loaded page are in it.
  pageNonce();
  controller?.abort();
  const requested = base();
  const current = new AbortController();
  controller = current;
  // The scroll position of the page that is left, for the back button.
  history.replaceState({ ...history.state, scroll: window.scrollY }, '');
  let response: Response;
  try {
    const early = visit.init ? undefined : takePrefetched(visit.url, requested);
    const headers = new Headers(visit.init?.headers);
    headers.set('x-brumate-base', String(requested));
    response = await (early ??
      fetch(visit.url, { ...visit.init, headers, signal: current.signal }));
    // Other pages loaded for this page, whose IDs no longer fit the next one.
    clearPrefetched();
  } catch (error) {
    // A later navigation stopped this one.
    if (current.signal.aborted) {
      return;
    }
    location.assign(visit.url);
    throw error;
  }
  if (current.signal.aborted) {
    // A page that loaded early is not tied to the signal, so its body is cancelled here.
    response.body?.cancel().catch(() => {});
    return;
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
  // Frees the connection of a page that a later navigation replaced.
  const stop = (): void => {
    reader.cancel().catch(() => {});
  };
  // The next chunk, or nothing once a later navigation started.
  const read = async (): Promise<ReadableStreamReadResult<string> | undefined> => {
    try {
      const chunk = await reader.read();
      if (!current.signal.aborted) {
        return chunk;
      }
    } catch (error) {
      if (!current.signal.aborted) {
        throw error;
      }
    }
    stop();
    return undefined;
  };

  // The first render ends with </html>. What comes after it streams in later.
  let text = '';
  let end = -1;
  while (end === -1) {
    // oxlint-disable-next-line no-await-in-loop -- Chunks arrive in order.
    const chunk = await read();
    if (!chunk) {
      return;
    }
    if (chunk.done) {
      end = text.length;
      break;
    }
    // A tag split across chunks starts at the last `<` of the text so far.
    HTML_END.lastIndex = Math.max(0, text.lastIndexOf('<'));
    text += chunk.value;
    const match = HTML_END.exec(text);
    if (match) {
      end = match.index + match[0].length;
    }
  }
  const next = new DOMParser().parseFromString(text.slice(0, end), 'text/html');
  const state = next.body.querySelector(`${STATE}[data-route]`);
  const shift = visit.init ? undefined : shiftFor(state, requested);
  if (shift) {
    shiftIds(next.body, shift);
  }
  // A link keeps the layouts that stay the same. A form replaces the whole page,
  // because what it changed can show anywhere on it.
  const routes = visit.init ? undefined : planRoutes(next, state, requested);
  await visit.leave(routes !== undefined);
  if (current.signal.aborted) {
    stop();
    return;
  }
  await transition(visit, () => {
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
      replaceRoutes(next, state!, routes);
    } else {
      document.body.replaceWith(document.adoptNode(next.body));
      // The state records of the page run in order, so the core reads them when it starts again.
      for (const script of document.body.querySelectorAll<HTMLScriptElement>(STATE)) {
        script.replaceWith(runnable(script));
      }
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
  });
  if (current.signal.aborted) {
    stop();
    return;
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
      append([...sink.body.childNodes].slice(0, -1), shift);
    }
    // oxlint-disable-next-line no-await-in-loop -- Chunks arrive in order.
    const chunk = await read();
    if (!chunk) {
      return;
    }
    if (chunk.done) {
      break;
    }
    rest = chunk.value;
  }
  sink.close();
  append([...sink.body.childNodes], shift);
}
