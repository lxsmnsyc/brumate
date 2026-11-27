// Indexes the comments that mark inserts and blocks and the elements with an anchor, finds them
// again, and clears the range of a block.

import { HAS_CLIENT_HTML, HAS_LATE_MARKUP } from '../features.ts';
import { parseId } from '../shared.ts';
import type { ScopeId } from '../shared.ts';
import { comments, elements, scopes } from './state.ts';
import type { Scope } from './state.ts';

/**
 * Indexes the markers of markup that others insert, such as streamed
 * `#loading` bodies and the pages that navigation adds, so `findComment` can
 * take its records at once.
 */
export let markerObserver: MutationObserver | undefined;

/** Indexes the markers of markup that others insert from now on. */
export function observeMarkers(): void {
  markerObserver = new MutationObserver(indexAdded);
  markerObserver.observe(document, { childList: true, subtree: true });
}

/** Stops indexing the markup that others insert. */
export function stopObserving(): void {
  markerObserver?.disconnect();
  markerObserver = undefined;
}

// DOM

export const MARKER: RegExp = /^[btilP]-?\d/;

function markerKey(data: string): string {
  return data[0] === 'b' ? data.split(':').slice(0, 2).join(':') : data;
}

const SCOPE_MARKER = /^[tb](-?[\d.]+):/;

/** True for markup that names a scope from the server: a `b-b` or marker with an ID that is not negative. */
export const SERVER_SCOPES: RegExp = /b-b="\d|<!--[tb]\d/;

/** The scopes that the client made since the last insert, which the next insert holds. */
export const rendered: Scope[] = [];

/** How many `#portal` markers the page has had, so a scope looks for its own only when any have. */
export let portals = 0;

/**
 * Names a comment of cloned markup that names a scope, such as the start of an item. The start
 * of a portal, which its scope looks for when it goes, is indexed.
 */
export function nameComment(place: Comment, data: string): void {
  place.data = data;
  if (data[0] === 'P') {
    comments.set(data, place);
    portals++;
  }
}

/**
 * Indexes the markers and the bound elements under `root`, so that updates find them without a
 * search of the page. A search for each row of a long list takes time that grows with the list.
 * With `ids`, it also collects the IDs of the scopes that the markup names. The IDs of scopes
 * that the client made are negative.
 */
export function indexMarkers(root: Node, ids?: Set<ScopeId>, withElements = true): void {
  // The query finds the bound elements in native code, and the walk visits only comments, so
  // the code here runs for each marker, not for each node of a long list.
  if (withElements) {
    indexElements(root, ids);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Comment).data;
    if (!MARKER.test(data)) {
      continue;
    }
    comments.set(markerKey(data), node as Comment);
    if (data[0] === 'P') {
      portals++;
    }
    const match = ids && SCOPE_MARKER.exec(data);
    if (match) {
      ids!.add(parseId(match[1]!));
    }
  }
}

/** The size of the indexes at which they next drop the nodes that left the page. */
let sweepAt = 4096;

/**
 * Drops the nodes that left the page from the indexes, once they have grown to twice their size
 * after the last sweep, so a list that the client fills and empties again does not keep its old
 * rows. A node that comes back is indexed again when it is inserted.
 */
export function sweepIndexes(): void {
  if (comments.size + elements.size < sweepAt) {
    return;
  }
  for (const [key, node] of comments) {
    if (!node.isConnected) {
      comments.delete(key);
    }
  }
  for (const [key, node] of elements) {
    if (!node.isConnected) {
      elements.delete(key);
    }
  }
  sweepAt = Math.max(4096, 2 * (comments.size + elements.size));
}

function indexElements(root: Node, ids?: Set<ScopeId>): void {
  if (root.nodeType === 1) {
    indexElement(root as Element, ids);
  }
  if (root.nodeType === 1 || root.nodeType === 9 || root.nodeType === 11) {
    for (const element of (root as ParentNode).querySelectorAll('[b-b]')) {
      indexElement(element, ids);
    }
  }
}

/**
 * The nodes that inserts of the client put in the page, from the first to the last of each,
 * whose bound elements are not indexed yet. A list that the client creates is often never
 * updated row by row, so its elements are indexed when an update first needs one of them.
 */
export const unindexed: [first: Node, last: Node][] = [];

export function indexInserts(): void {
  for (const [first, last] of unindexed.splice(0)) {
    if (first.isConnected) {
      for (let node: Node | null = first; node; node = node.nextSibling) {
        indexElements(node);
        if (node === last) {
          break;
        }
      }
    } else if (last.isConnected) {
      // The first nodes left the page, such as the first rows of a list that were removed, so
      // the walk goes back from the last node, past the start of the insert if it must.
      for (let node: Node | null = last; node; node = node.previousSibling) {
        indexElements(node);
      }
    }
  }
}

function indexElement(element: Element, ids?: Set<ScopeId>): void {
  const key = element.getAttribute('b-b');
  if (key === null) {
    return;
  }
  elements.set(key, element);
  ids?.add(parseId(key.slice(0, key.indexOf(':'))));
}

/** Indexes the markers in the nodes that mutation records added. */
export function indexAdded(records: MutationRecord[]): void {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType === 1) {
        indexMarkers(node);
      } else if (node.nodeType === 8 && MARKER.test((node as Comment).data)) {
        const data = (node as Comment).data;
        comments.set(markerKey(data), node as Comment);
        if (data[0] === 'P') {
          portals++;
        }
      }
    }
  }
}

/**
 * Finds a marker in the page. Returns undefined when the markup is not in
 * the page, such as `children` inside a block that is closed. Updates to it
 * do nothing, and it updates when the client inserts it again.
 */
export function findComment(key: string): Comment | undefined {
  let comment = comments.get(key);
  if (!comment?.isConnected) {
    // The index has every marker in the page once it reads the records that
    // are waiting. Before the core starts, or between pages, it reads the page.
    // Without markup that others insert, the index has every marker of the page already, once
    // the browser has read all of it.
    if (HAS_LATE_MARKUP && markerObserver) {
      indexAdded(markerObserver.takeRecords());
    } else if (HAS_LATE_MARKUP || document.readyState === 'loading') {
      indexMarkers(document.documentElement);
    }
    comment = comments.get(key);
  }
  return comment?.isConnected ? comment : undefined;
}

export function findElement(scope: ScopeId, anchor: number): Element | null {
  const own = scopes.get(scope)?.n?.[anchor];
  if (own?.isConnected) {
    return own as Element;
  }
  const key = `${scope}:${anchor}`;
  let element = elements.get(key);
  if (!element?.isConnected) {
    // As for markers: once the core starts, the index has every bound element in the page,
    // with those of the inserts that are waiting.
    if (HAS_LATE_MARKUP && markerObserver) {
      indexAdded(markerObserver.takeRecords());
    }
    // The inserts of the core are read when an update first needs one of their elements.
    if (HAS_CLIENT_HTML) {
      indexInserts();
    }
    element = elements.get(key);
    // An insert whose first node left the page, such as the first row of a list that was
    // removed, has elements that the walk did not reach.
    if (!element?.isConnected) {
      element = document.querySelector(`[b-b="${key}"]`) ?? undefined;
      if (element) {
        elements.set(key, element);
      }
    }
  }
  return element?.isConnected ? element : null;
}

/** The start marker of a block: kept on its scope in a clone, or found in the page. */
export function blockStart(scope: Scope, anchor: number): Comment | undefined {
  const kept = scope.n?.[anchor];
  return kept?.isConnected && kept.nodeType === 8
    ? (kept as Comment)
    : findComment(`b${scope.id}:${anchor}`);
}

/** Returns the marker that ends the range that `start` opens. */
export function rangeEnd(start: Comment): Comment {
  let depth = 0;
  for (let node = start.nextSibling; node; node = node.nextSibling) {
    if (node.nodeType === 8) {
      const data = (node as Comment).data;
      if (data[0] === '/') {
        if (depth === 0) {
          return node as Comment;
        }
        depth--;
      } else if (MARKER.test(data)) {
        depth++;
      }
    }
  }
  // The markers sit in different parents when the browser's parser closes an element early, such
  // as a <p> that holds a <div>.
  throw new Error(
    `Missing end marker for <!--${start.data}-->. A <p> or another element that closes early around a block, such as a <div>, splits its markers.`,
  );
}

export function clear(start: Node, end: Node): void {
  if (start.nextSibling === end || !start.nextSibling) {
    return;
  }
  // One removal of the whole range, which costs less than one for each node of a long list.
  const range = document.createRange();
  range.setStartAfter(start);
  range.setEndBefore(end);
  range.deleteContents();
}
