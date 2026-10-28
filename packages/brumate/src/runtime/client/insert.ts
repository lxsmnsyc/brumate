// Puts HTML or a clone into the page: the parse, the index of its markers, and the updates of the
// scopes in it.

import { HAS_CLIENT_HTML, HAS_LATE_MARKUP } from '../features.ts';
import type { ScopeId } from '../shared.ts';
import { trustedHTML } from '../trusted.ts';
import {
  SERVER_SCOPES,
  indexAdded,
  indexInserts,
  indexMarkers,
  markerObserver,
  rendered,
  unindexed,
} from './blocks.ts';
import { codeReady, loadModule, loadPart } from './code.ts';
import { afterInsert, rootOf } from './scopes.ts';
import { hiding, options, scopes } from './state.ts';
import type { ClientModule, Scope } from './state.ts';
import { watchTitles } from './titles.ts';

/** True while `refresh` runs the updates of scopes that the server rendered. */
export let refreshing: boolean = false;

/**
 * Updates scopes that the server rendered before values changed on the
 * client, such as the body of a `#loading` block that streams in after an
 * event. Effects do not run: they run only when a value changes. With
 * `memosOnly`, as for scopes that the client just rendered with its values,
 * only the memos run, so the ones that load start.
 */
export function refresh(added: Scope[], memosOnly = false): void {
  // The scopes of each module, which load it once.
  const byModule = new Map<string, Scope[]>();
  for (const scope of added) {
    const id = rootOf(scope).m;
    if (!id) {
      continue;
    }
    const list = byModule.get(id);
    if (list) {
      list.push(scope);
    } else {
      byModule.set(id, [scope]);
    }
  }
  for (const [id, list] of byModule) {
    void loadModule(id).then(async (module) => {
      // The names of the updates of each kind of scope, memos first, so the other updates read
      // their new values.
      const byKind = new Map<number, string[]>();
      for (const scope of list) {
        if (!byKind.has(scope.k)) {
          byKind.set(scope.k, refreshNames(module, scope.k, memosOnly));
        }
      }
      let any = false;
      for (const names of byKind.values()) {
        any ||= names.length > 0;
      }
      if (!any) {
        return;
      }
      const updates = await loadPart(module, 'update');
      // The updates can render templates and call functions of other components.
      await codeReady();
      refreshing = true;
      try {
        for (const scope of list) {
          for (const name of byKind.get(scope.k)!) {
            if (scopes.has(scope.id)) {
              (updates[name] as (scope: Scope) => void)(scope);
            }
          }
        }
      } finally {
        refreshing = false;
      }
    });
  }
}

/** The names of the updates of a kind of scope that `refresh` runs, memos first. */
function refreshNames(module: ClientModule, kind: number, memosOnly: boolean): string[] {
  const memos = new Set<string>();
  const others = new Set<string>();
  for (const slots of Object.values(module.g)) {
    for (const entries of Object.values(slots)) {
      for (const [entryKind, name] of entries) {
        if (entryKind !== kind || name[0] === 'e') {
          continue;
        }
        if (name[0] === 'm') {
          memos.add(name);
        } else if (!memosOnly) {
          others.add(name);
        }
      }
    }
  }
  return [...memos, ...others];
}

/**
 * Inserts rendered HTML before a node, or at the end of a parent, and runs
 * the work that waits for it.
 */
export function insertHTML(
  before: Node | { parent: ParentNode },
  html: string | DocumentFragment | DocumentFragment[],
): void {
  // A fragment that the browser cloned from a template keeps its elements on their scopes, so
  // it is not parsed or indexed. The clones of a list go in one by one, so each node moves once.
  const cloned = typeof html !== 'string';
  let fragments: DocumentFragment[];
  if (typeof html === 'string') {
    fragments = [parseHTML(html, 'parent' in before ? before.parent : before)];
  } else {
    fragments = Array.isArray(html) ? html : [html];
  }
  // Markers that others inserted first, so the new markers win over them.
  if (HAS_LATE_MARKUP && markerObserver) {
    indexAdded(markerObserver.takeRecords());
  }
  // The scopes that the renders since the last insert made, whose markup this is.
  const client = rendered.splice(0);
  // Markup from the server, such as `children`, names scopes with IDs that are not negative.
  // Only then are the elements of the insert read for them now.
  const fromServer = !cloned && SERVER_SCOPES.test(html);
  const ids = fromServer ? new Set<ScopeId>() : undefined;
  const markup = clonedMarkup;
  for (const fragment of fragments) {
    if (!cloned || markup) {
      // The elements of HTML in a clone are read now, since the clone is not indexed later.
      indexMarkers(fragment, ids, fromServer || cloned || !HAS_CLIENT_HTML);
      // A clone's handlers were read from its template, unless it holds markup that it rendered.
      options.listen(fragment);
    }
    watchTitles(fragment);
  }
  clonedMarkup = false;
  const server: Scope[] = [];
  for (const id of ids ?? []) {
    const scope = typeof id === 'number' && id < 0 ? undefined : scopes.get(id);
    if (scope) {
      server.push(scope);
    }
  }
  const fragment = fragments[0]!;
  if (HAS_CLIENT_HTML && !cloned && !fromServer && fragment.firstChild) {
    unindexed.push([fragment.firstChild, fragment.lastChild!]);
    // Many inserts that no update read are indexed at once, so they do not hold their nodes.
    if (unindexed.length > 256) {
      indexInserts();
    }
  }
  // The nodes of the insert, when hidden `#offscreen` markup can contain them.
  const added = hiding?.bodies.size ? fragments.flatMap((part) => [...part.childNodes]) : undefined;
  for (const part of fragments) {
    if ('parent' in before) {
      before.parent.append(part);
    } else {
      before.parentNode!.insertBefore(part, before);
    }
  }
  if (added) {
    hiding!.added(added);
  }
  // The records of this insert, whose markers are indexed and whose handlers listen already.
  if (HAS_LATE_MARKUP) {
    markerObserver?.takeRecords();
  }
  options.inserted?.();
  // A callback can add more, such as the call of a setter after the write of a ref.
  for (let fn = afterInsert.shift(); fn; fn = afterInsert.shift()) {
    fn();
  }
  // HTML from the server, such as `children`, can be older than the values on the client.
  if (server.length > 0) {
    refresh(server);
  }
  // Scopes that the client just rendered have its values, but the memos that load start here.
  const live = client.filter((scope) => scopes.has(scope.id));
  if (live.length > 0) {
    refresh(live, true);
  }
}

/** True when a clone holds markup that it rendered as HTML, whose markers its insert indexes. */
let clonedMarkup = false;

/** Notes that a clone holds markup that it rendered as HTML. */
export function markCloned(): void {
  clonedMarkup = true;
}

/**
 * The clones of components that HTML holds a place for, by the number in the place,
 * `<!--f` and the number. HTML that the browser parses gets them back in their places.
 */
const placed = new Map<number, DocumentFragment>();

let placedCount = 0;

/**
 * `svg` or `math` when markup in an element, or next to a node, is SVG or MathML. HTML that the
 * browser parses there needs one around it, as the parser of a page would have one.
 */
export function foreignOf(near: Node | null | undefined): string | undefined {
  const element = near?.nodeType === 1 ? (near as Element) : near?.parentNode;
  if (element?.nodeType !== 1 || (element as Element).localName === 'foreignObject') {
    return undefined;
  }
  const space = (element as Element).namespaceURI;
  if (space === 'http://www.w3.org/2000/svg') {
    return 'svg';
  }
  return space === 'http://www.w3.org/1998/Math/MathML' ? 'math' : undefined;
}

/**
 * Parses HTML that the browser renders, with the clones that it holds places for. `near` is
 * the element that it goes in, or a node next to where it goes.
 */
export function parseHTML(
  html: string,
  near?: Node | null,
  foreign: string | undefined = foreignOf(near),
): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = trustedHTML(foreign ? `<${foreign}>${html}</${foreign}>` : html);
  const fragment = template.content;
  if (foreign) {
    fragment.replaceChildren(...fragment.firstChild!.childNodes);
  }
  if (HAS_CLIENT_HTML && placed.size > 0 && html.includes('<!--f')) {
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_COMMENT);
    const places: Comment[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (/^f\d+$/.test((node as Comment).data)) {
        places.push(node as Comment);
      }
    }
    for (const place of places) {
      const key = Number(place.data.slice(1));
      const nodes = placed.get(key);
      if (nodes) {
        placed.delete(key);
        place.replaceWith(nodes);
      }
    }
  }
  return fragment;
}

/** The markup of a render, or for a clone, a comment that holds its place, which a parse fills. */
export function holdPlace(out: string | DocumentFragment): string {
  if (typeof out === 'string') {
    return out;
  }
  const key = placedCount++;
  placed.set(key, out);
  return `<!--f${key}-->`;
}
