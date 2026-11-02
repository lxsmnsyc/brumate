// Markup that the browser clones: a template parsed once, the walk to its nodes, and the helpers
// that fill a clone.

import { HAS_CHILDREN } from '../features.ts';
import { attributeText, onValue } from '../html.ts';
import type { ScopeId } from '../shared.ts';
import { trustedHTML } from '../trusted.ts';
import type { Render } from './branches.ts';
import { Children, TemplateCall, insert } from './children.ts';
import { fail } from './errors.ts';
import { spread } from './handlers.ts';
import { findForeign, holdPlace, markCloned, parseHTML } from './insert.ts';
import { resolveScope } from './scopes.ts';
import { options, scopes } from './state.ts';
import type { Scope } from './state.ts';
import { isThenable } from './updates.ts';

/** Markup that the browser clones, and the paths to the elements that its render writes. */
interface Template {
  html: string;
  /** How many elements the render writes, which have `b-x` in `html`. */
  count: number;
  /** `svg` or `math`, for markup whose elements are of SVG or MathML, which parses inside one. */
  foreign?: string;
  t?: HTMLTemplateElement;
  /** The moves that reach the marked nodes of a clone. See `encodeWalk`. */
  walk?: number[];
}

/** A template of the markup of a render, which `clone` parses once. */
export function template(html: string, count: number, foreign?: string): Template {
  return { html, count, foreign };
}

/**
 * Parses a template, and finds the path to each element that it marks with `b-x`, as the parser
 * placed it: after the parser's own changes, such as a `<tbody>` that it adds.
 */
function parseTemplate(source: Template): number[][] {
  const element = document.createElement('template');
  element.innerHTML = trustedHTML(
    source.foreign ? `<${source.foreign}>${source.html}</${source.foreign}>` : source.html,
  );
  const root = element.content;
  if (source.foreign) {
    root.replaceChildren(...root.firstChild!.childNodes);
  }
  const paths: number[][] = Array.from({ length: source.count });
  function findPath(marked: Node): number[] {
    const path: number[] = [];
    for (let node: Node = marked; node !== root; node = node.parentNode!) {
      let index = 0;
      for (let before = node.previousSibling; before; before = before.previousSibling) {
        index++;
      }
      path.unshift(index);
    }
    return path;
  }
  for (const marked of root.querySelectorAll('[b-x]')) {
    paths[Number(marked.getAttribute('b-x'))] = findPath(marked);
    marked.removeAttribute('b-x');
  }
  // The start comments of text inserts, `<!--x` and an index, which each clone names.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const mark = /^x(\d+)$/.exec((node as Comment).data);
    if (mark) {
      paths[Number(mark[1])] = findPath(node);
    }
  }
  // The loader listens to the events of the handlers of the template once, not of each clone.
  // A render before the core starts, such as in a test, has nothing that listens yet.
  options?.listen(root);
  source.t = element;
  return paths;
}

// The moves of a walk: a number from 0 is the index of the node that the walk is at, and the
// others move it.
const FIRST_CHILD = -1;

const PARENT = -2;

// `NEXT - n` moves to the `n`th next sibling.
const NEXT = -2;

/**
 * The moves that reach the marked nodes of a template, in the order of the markup, from one to
 * the next: up to the ancestor that they share, along its children, and down. A clone makes
 * them once for its template, as Marko encodes a walk, so the clones of a render do not walk
 * from the top for each node or make an array of paths.
 */
function encodeWalk(paths: number[][]): number[] {
  const marked: { path: number[]; mark: number }[] = [];
  for (const [mark, path] of paths.entries()) {
    marked.push({ path, mark });
  }
  const order = marked.sort((a, b) => {
    for (let depth = 0; depth < Math.min(a.path.length, b.path.length); depth++) {
      if (a.path[depth] !== b.path[depth]) {
        return a.path[depth]! - b.path[depth]!;
      }
    }
    return a.path.length - b.path.length;
  });
  const moves: number[] = [];
  function along(count: number): void {
    if (count > 0) {
      moves.push(NEXT - count);
    }
  }
  let current: number[] = [];
  for (const { path, mark } of order) {
    let shared = 0;
    while (shared < current.length && current[shared] === path[shared]) {
      shared++;
    }
    let depth = shared;
    if (shared < current.length) {
      // Up to the child of the shared ancestor that holds the last node, then along to the
      // child that holds this one.
      for (let up = current.length - 1; up > shared; up--) {
        moves.push(PARENT);
      }
      along(path[shared]! - current[shared]!);
      depth++;
    }
    for (; depth < path.length; depth++) {
      moves.push(FIRST_CHILD);
      along(path[depth]!);
    }
    moves.push(mark);
    current = path;
  }
  return moves;
}

/**
 * A node of a clone: an element, the comment of an insert, or the fragment. The type lets the
 * render pass each to the write that takes it.
 */
type ClonedNode = Element & Comment & DocumentFragment;

/**
 * Clones a template. Returns the nodes that the template marks, by their index, and the fragment
 * after them, in one array.
 */
export function clone(source: Template): ClonedNode[] {
  const walk = (source.walk ??= encodeWalk(parseTemplate(source)));
  const fragment = source.t!.content.cloneNode(true);
  // oxlint-disable-next-line unicorn/no-new-array -- A length, with no values written in yet.
  const cloned: Node[] = new Array(source.count + 1);
  cloned[source.count] = fragment;
  let node: Node = fragment;
  for (let index = 0; index < walk.length; index++) {
    const move = walk[index]!;
    if (move >= 0) {
      cloned[move] = node;
    } else if (move === FIRST_CHILD) {
      node = node.firstChild!;
    } else if (move === PARENT) {
      node = node.parentNode!;
    } else {
      for (let step = NEXT - move; step > 0; step--) {
        node = node.nextSibling!;
      }
    }
  }
  return cloned as ClonedNode[];
}

/**
 * Keeps an element of cloned markup on its scope, where updates find it. An element at the top
 * of the clone, or one with handlers, gets its `b-b` too, which `list` and the handlers read to
 * find the scope.
 */
export function keep(scope: ScopeId, anchor: number, element: Element, named?: boolean): void {
  const found = scopes.get(scope);
  if (found) {
    (found.n ??= [])[anchor] = element;
  }
  // `named`: elements inside it have handlers and find their scope from it with `closest`.
  if (named || element.parentNode?.nodeType === 11 || element.hasAttribute('b-on')) {
    element.setAttribute('b-b', `${scope}:${anchor}`);
  }
}

/**
 * Puts the value of a text insert of cloned markup in the place of its comment. A text value is
 * a text node, which the scope keeps, as Solid keeps it, so an update sets its data. Other
 * values render between the markers of an insert, as in HTML.
 */
export function keepText(
  scope: ScopeId,
  anchor: number,
  place: Comment,
  value: unknown,
  at: ScopeId | Scope = scope,
): void {
  const found = scopes.get(scope);
  if (typeof value === 'string' || typeof value === 'number') {
    const node = document.createTextNode(String(value));
    place.replaceWith(node);
    if (found) {
      (found.n ??= [])[anchor] = node;
    }
    return;
  }
  keepMarkers(scope, anchor, place, value, at);
}

/** Puts a text insert at the end of an element of cloned markup, as `keepText` does. */
export function appendText(
  scope: ScopeId,
  anchor: number,
  parent: Element,
  value: unknown,
  at: ScopeId | Scope = scope,
): void {
  if (typeof value === 'string' || typeof value === 'number') {
    const node = document.createTextNode(String(value));
    parent.append(node);
    const found = scopes.get(scope);
    if (found) {
      (found.n ??= [])[anchor] = node;
    }
    return;
  }
  const place = document.createComment('');
  parent.append(place);
  keepMarkers(scope, anchor, place, value, at);
}

/** Gives a value that is not text the markers of an insert, and renders it between them. */
function keepMarkers(
  scope: ScopeId,
  anchor: number,
  place: Comment,
  value: unknown,
  at: ScopeId | Scope,
): void {
  const found = scopes.get(scope);
  place.data = `t${scope}:${anchor}`;
  place.after(document.createComment('/t'));
  if (found) {
    (found.n ??= [])[anchor] = place;
  }
  if (value !== null && value !== undefined && typeof value !== 'boolean') {
    // Children, a template or raw HTML.
    place.after(insertNodes(value, at, place));
  }
}

/** Names the start marker of a nested block of cloned markup, and keeps it on its scope. */
function keepBlock(
  place: Comment,
  scope: ScopeId,
  data: string,
  anchor: number,
): Scope | undefined {
  place.data = data;
  const found = scopes.get(scope);
  if (found) {
    (found.n ??= [])[anchor] = place;
  }
  return found;
}

/** Puts what renders gave into the range that a marker of cloned markup opens. */
function fillRange(place: Comment, html: string, inserted: DocumentFragment | undefined): void {
  if (html) {
    // Markup that a render gave as HTML, which the insert of the clone indexes.
    place.after(parseHTML(html, place));
    markCloned();
  } else if (inserted) {
    place.after(inserted);
  }
}

/** Names the start marker of a block whose markup is in the clone, and keeps it on its scope. */
export function markBlock(place: Comment, scope: ScopeId, anchor: number, suffix: string): void {
  keepBlock(place, scope, `b${scope}:${anchor}${suffix}`, anchor);
}

/**
 * Fills a nested `#if` of cloned markup with the branch at `index`, or nothing for -1, before
 * the clone is in the page. `branch` updates it later.
 */
export function fillBranch(
  place: Comment,
  scope: ScopeId,
  anchor: number,
  index: number,
  renders: Render[],
): void {
  const found = keepBlock(place, scope, `b${scope}:${anchor}:${index}`, anchor);
  const render = renders[index];
  if (found && render) {
    const out = render(found);
    fillRange(place, typeof out === 'string' ? out : '', typeof out === 'string' ? undefined : out);
  }
}

/** Fills a nested `#for` of cloned markup with its items, before the clone is in the page. */
export function fillList(
  place: Comment,
  scope: ScopeId,
  anchor: number,
  items: unknown[],
  render: Render,
): void {
  const found = keepBlock(place, scope, `b${scope}:${anchor}`, anchor);
  if (!found) {
    return;
  }
  let html = '';
  let parts: DocumentFragment | undefined;
  for (let index = 0; index < items.length; index++) {
    const out = render(found, items[index], index);
    if (typeof out === 'string') {
      html += out;
    } else {
      (parts ??= document.createDocumentFragment()).append(out);
    }
  }
  fillRange(place, html, parts);
}

/** Writes an attribute of an element of cloned markup, as `attribute` writes it in HTML. */
export function setAttr(element: Element, name: string, value: unknown): void {
  const written = attributeText(name, value);
  if (written !== undefined) {
    element.setAttribute(name, written);
  }
}

/** The nodes of a block that renders where it is, in HTML: a place, which the parse fills. */
export function nodes(fragment: DocumentFragment): string {
  return holdPlace(fragment);
}

/** What a body gave, as nodes: its clone, or its HTML, which the insert of the clone indexes. */
function bodyNodes(out: string | DocumentFragment): DocumentFragment {
  if (typeof out !== 'string') {
    return out;
  }
  markCloned();
  return parseHTML(out);
}

/** The markers of a block that renders where it is, around its nodes, with the start kept. */
function blockNodes(
  scope: ScopeId | undefined,
  anchor: number | undefined,
  data: string,
  content: DocumentFragment,
): DocumentFragment {
  if (scope === undefined || anchor === undefined) {
    return content;
  }
  const start = document.createComment(data);
  keepBlock(start, scope, data, anchor);
  content.prepend(start);
  content.append(document.createComment('/b'));
  return content;
}

/**
 * Renders an `#if` or a `#switch` where it is: the branch at `index`, or nothing for -1, between
 * its markers when it has them, which `branch` updates later.
 */
export function branchNodes(
  scope: ScopeId | undefined,
  anchor: number | undefined,
  index: number,
  bodies: (() => string | DocumentFragment)[],
): DocumentFragment {
  const body = bodies[index];
  const content = body ? bodyNodes(body()) : document.createDocumentFragment();
  return blockNodes(scope, anchor, `b${scope}:${anchor}:${index}`, content);
}

/**
 * Renders a `#for` or a `#repeat` where it is: its items, or its fallback for none, between its
 * markers when it has them, which `list` updates later.
 */
export function listNodes(
  scope: ScopeId | undefined,
  anchor: number | undefined,
  items: unknown[],
  body: (item: unknown, index: number) => string | DocumentFragment,
  fallback: (() => string | DocumentFragment) | undefined,
): DocumentFragment {
  const content = document.createDocumentFragment();
  for (let index = 0; index < items.length; index++) {
    content.append(bodyNodes(body(items[index], index)));
  }
  if (items.length === 0 && fallback) {
    content.append(bodyNodes(fallback()));
  }
  return blockNodes(scope, anchor, `b${scope}:${anchor}`, content);
}

/** Writes attributes that code of a start tag gave as their text, as HTML has them. */
export function setAttrText(element: Element, text: string): void {
  if (text) {
    // On an element of SVG or MathML, the parser gives the names their case, such as `viewBox`,
    // and their namespace, such as of `xlink:href`.
    const foreign = findForeign(element);
    const tag = foreign === 'math' ? 'mi' : 'g';
    const parsed = parseHTML(foreign ? `<${tag}${text}/>` : `<b${text}>`, undefined, foreign)
      .firstChild as Element;
    // The parsed attribute moves, so a name that `setAttribute` would reject, such as `@click`,
    // is written as the parser read it.
    for (const attribute of Array.from(parsed.attributes)) {
      parsed.removeAttributeNode(attribute);
      element.setAttributeNode(attribute);
    }
  }
}

/** Puts a value with no markers in the place of a comment of cloned markup, as `insert` does. */
export function putText(place: Comment, value: unknown, at?: ScopeId | Scope): void {
  place.replaceWith(
    typeof value === 'string' || typeof value === 'number'
      ? document.createTextNode(String(value))
      : insertNodes(value, at, place),
  );
}

/** Writes the spreads of an element of cloned markup, as `spread` writes them in HTML. */
export function setSpread(
  element: Element,
  attributes: Record<string, unknown>,
  on?: string[],
  names?: boolean,
): void {
  setAttrText(element, spread(attributes, on, names));
}

/** Writes the `b-on` of an element of cloned markup with spreads, as `onAttribute` does. */
export function setOn(element: Element, on: string[], own: string): void {
  const value = onValue(on, own);
  if (value) {
    // Before `keep`, which then writes the `b-b` that the handlers read.
    element.setAttribute('b-on', value);
    // The loader listens to the events of the handlers of the spreads.
    options?.listen(element);
  }
}

/**
 * The scope that `fillSettled` reported each rejection to, as two renders or two writes in one
 * scope can read the same memo.
 */
const reportedRejections = new WeakMap<object, Scope>();

/**
 * Writes cloned markup that reads memos which never change, once the ones that are promises
 * settle, as no update writes their values. A rejection goes to the nearest `#try` around the
 * scope, or `onError`.
 */
export function fillSettled(
  scope: ScopeId | Scope,
  values: unknown[],
  write: (...values: unknown[]) => void,
): void {
  let loading = false;
  for (const value of values) {
    loading ||= isThenable(value);
  }
  if (!loading) {
    write(...values);
    return;
  }
  const at = resolveScope(scope)!;
  Promise.all(values).then(
    (settled) => {
      // A closed block removed the nodes.
      if (scopes.get(at.id) === at) {
        write(...settled);
      }
    },
    (error: unknown) => {
      // A closed block shows nothing, so its error has no `#catch` to show.
      if (scopes.get(at.id) !== at) {
        return;
      }
      if (typeof error === 'object' && error !== null) {
        if (reportedRejections.get(error) === at) {
          return;
        }
        reportedRejections.set(error, at);
      }
      fail(at, error);
    },
  );
}

/** Writes the content of an element of cloned markup, as `insert` writes it in HTML. */
export function setContent(element: Element, value: unknown, at?: ScopeId | Scope): void {
  if (typeof value === 'string' || typeof value === 'number') {
    element.textContent = String(value);
    return;
  }
  // Children, a template or raw HTML render here. Their work after the insert waits for it.
  element.replaceChildren(insertNodes(value, at, element));
}

/**
 * The nodes of children, a template or raw HTML in cloned markup: the clone of children whose
 * markup clones, or the markup, which the insert of the clone indexes, as it would in HTML.
 */
function insertNodes(
  value: unknown,
  at: ScopeId | Scope | undefined,
  near: Node,
): DocumentFragment {
  const out =
    HAS_CHILDREN && value instanceof Children && !(value instanceof TemplateCall)
      ? value.render(resolveScope(at))
      : insert(value, undefined, at);
  if (typeof out !== 'string') {
    return out;
  }
  markCloned();
  return parseHTML(out, near);
}
