// Blocks that show one body of several: `#if`, `#switch`, `#key`, a dynamic tag, `#try`, `#client`
// and `#offscreen`.

import { parseId } from '../shared.ts';
import type { ComponentValue } from '../shared.ts';
import { blockStart, rangeEnd } from './blocks.ts';
import { loadModule } from './code.ts';
import { insertHTML } from './insert.ts';
import { call } from './references.ts';
import { afterInsert, disposeKinds, inPlace, removeBlock, findRoot } from './scopes.ts';
import { comments, hiding, scopes, setHiding } from './state.ts';
import type { Scope } from './state.ts';

export type Render = (parent: Scope, item?: unknown, index?: number) => string | DocumentFragment;

/** Shows the branch at `index` of `#if` or `#switch`, or nothing for -1. */
export function branch(
  scope: Scope,
  anchor: number,
  index: number,
  renders: (Render | undefined)[],
  kinds: number[],
  holderKind?: number,
  holderAnchor?: number,
): void {
  const start = blockStart(scope, anchor);
  if (!start) {
    return;
  }
  if (Number(start.data.split(':')[2]) === index) {
    return;
  }
  const end = rangeEnd(start);
  removeBlock(scope, kinds, start, end);
  start.data = `b${scope.id}:${anchor}:${index}`;
  const render = inPlace(scope, renders[index], holderKind, holderAnchor);
  if (render) {
    insertHTML(end, render(scope));
  }
}

/** Renders the body of `#key` again when its value changes. */
export function rekey(
  scope: Scope,
  anchor: number,
  value: unknown,
  render: Render,
  kinds: number[],
  holderKind?: number,
  holderAnchor?: number,
): void {
  scope.keys ??= new Map();
  if (scope.keys.has(anchor) && Object.is(scope.keys.get(anchor), value)) {
    return;
  }
  scope.keys.set(anchor, value);
  const start = blockStart(scope, anchor);
  if (!start) {
    return;
  }
  const end = rangeEnd(start);
  removeBlock(scope, kinds, start, end);
  insertHTML(end, inPlace(scope, render, holderKind, holderAnchor)!(scope));
}

/**
 * `rekey` for the block around a dynamic tag. The first update keeps the element that the server
 * rendered, when it has the tag already, such as an update of a scope that streams in after an
 * event.
 */
export function retag(
  scope: Scope,
  anchor: number,
  value: unknown,
  render: Render,
  kinds: number[],
  holderKind?: number,
  holderAnchor?: number,
): void {
  scope.keys ??= new Map();
  if (!scope.keys.has(anchor) && typeof value === 'string') {
    const start = blockStart(scope, anchor);
    let node = start?.nextSibling;
    while (node && node.nodeType !== 1 && node.nodeType !== 8) {
      node = node.nextSibling;
    }
    if (node?.nodeType === 1 && (node as Element).localName === value.toLowerCase()) {
      scope.keys.set(anchor, value);
      return;
    }
  }
  // A component in the tag: the first update keeps it when the block holds the same component.
  if (!scope.keys.has(anchor) && typeof value === 'function') {
    for (const block of scopes.values()) {
      if (block.p === scope && kinds.includes(block.k)) {
        for (const id of Object.values(block.c ?? {})) {
          if (scopes.get(id)?.m === (value as ComponentValue).brumateId) {
            scope.keys.set(anchor, value);
            return;
          }
        }
      }
    }
  }
  rekey(scope, anchor, value, render, kinds, holderKind, holderAnchor);
}

/**
 * Renders the body of a `#try` block again, for its `reset` function. If the
 * body throws, the fallback renders again with the error.
 */
export async function reset(
  scope: Scope,
  anchor: number,
  id: string,
  body: string,
  fallback: string,
  kinds: number[],
  holderKind?: number,
  holderAnchor?: number,
): Promise<void> {
  const updates = (await loadModule(id)) as unknown as Record<string, unknown>;
  const start = blockStart(scope, anchor);
  if (!start) {
    return;
  }
  const end = rangeEnd(start);
  removeBlock(scope, kinds, start, end);
  let html: string | DocumentFragment;
  try {
    html = inPlace(scope, updates[body] as Render, holderKind, holderAnchor)!(scope);
  } catch (error) {
    // Scopes that the body created before it threw.
    disposeKinds(scope, kinds);
    afterInsert.length = 0;
    const render = inPlace(scope, updates[fallback] as Render, holderKind, holderAnchor)!;
    html = (render as unknown as (parent: Scope, error: unknown) => string)(scope, error);
  }
  insertHTML(end, html);
}

/**
 * Renders the body of a `#client` block once, in place of its fallback.
 * `kinds` are the scope IDs inside the fallback, whose instances go.
 */
export function fill(
  scope: Scope,
  anchor: number,
  render: Render,
  kinds: number[] = [],
  holderKind?: number,
  holderAnchor?: number,
): void {
  const start = blockStart(scope, anchor);
  // A block that rendered its body has a third number.
  if (!start || start.data.split(':').length > 2) {
    return;
  }
  start.data += ':1';
  const end = rangeEnd(start);
  removeBlock(scope, kinds, start, end);
  insertHTML(end, inPlace(scope, render, holderKind, holderAnchor)!(scope));
}

/**
 * Shows or hides the body of an `#offscreen` block. A body that the page
 * does not have yet renders the first time it shows. `kind` is the body's
 * scope ID in the compiled component.
 */
export function offscreen(
  scope: Scope,
  anchor: number,
  value: unknown,
  render: Render,
  kind: number,
  holderKind?: number,
  holderAnchor?: number,
): void {
  const start = blockStart(scope, anchor);
  if (!start) {
    return;
  }
  const visible = Boolean(value);
  // 1 for a body that shows, 0 for one that is hidden, and -1 for one that has not rendered.
  const state = start.data.split(':')[2];
  if (visible ? state === '1' : state !== '1') {
    return;
  }
  start.data = `b${scope.id}:${anchor}:${visible ? 1 : 0}`;
  const end = rangeEnd(start);
  if (state === '-1') {
    insertHTML(end, inPlace(scope, render, holderKind, holderAnchor)!(scope));
    return;
  }
  let body: Scope | undefined;
  for (const child of scope.children ?? []) {
    if (child.k === kind) {
      body = child;
    }
  }
  if (body) {
    const holder = hiding ?? setHiding(createHiding())!;
    if (visible) {
      holder.show(body);
    } else {
      holder.hide(body, start, end);
    }
  }
}

/** A hidden `#offscreen` body: its scope, and the ranges of its markup and of its portals. */
export interface HiddenBody {
  scope: Scope;
  ranges: [start: Comment, end: Comment][];
}

/**
 * What a hidden node had before it was hidden: `n` hidden bodies that hide
 * it, and the text of a text node, or the inline `display` of an element
 * with its priority and whether it had a `style` attribute.
 */
interface Saved {
  n: number;
  v: string;
  p?: string;
  a?: boolean;
}

export interface Hiding {
  bodies: Set<HiddenBody>;
  nodes: WeakMap<Node, Saved>;
  hide: (body: Scope, start: Comment, end: Comment) => void;
  show: (body: Scope) => void;
  /** True for a scope in a hidden body. */
  hidden: (scope: Scope) => boolean;
  /** Keeps an effect for when its body shows, and returns true, if its scope is hidden. */
  paused: (scope: Scope, name: string) => boolean;
  /** Hides the nodes that an insert added to hidden markup. */
  added: (nodes: Node[]) => void;
  /** Keeps an element hidden after its `style` attribute changed. */
  styled: (element: Element) => void;
}

/** True for a scope that is `ancestor` or inside it, also through the owner of a component. */
function within(scope: Scope, ancestor: Scope): boolean {
  for (let current: Scope | undefined = scope; current; current = current.p ?? current.o) {
    if (current === ancestor) {
      return true;
    }
  }
  return false;
}

/** True for a scope in a hidden `#offscreen` body. */
function hidden(scope: Scope): boolean {
  for (let current: Scope | undefined = scope; current; current = current.p ?? current.o) {
    if (current.h) {
      return true;
    }
  }
  return false;
}

/** The nodes between two markers. */
function between([start, end]: [Comment, Comment]): Node[] {
  const result: Node[] = [];
  for (let node = start.nextSibling; node && node !== end; node = node.nextSibling) {
    result.push(node);
  }
  return result;
}

/** The inline style of an element, which an element that is not HTML or SVG may not have. */
function display(element: Element): CSSStyleDeclaration | undefined {
  return (element as HTMLElement).style;
}

function createHiding(): Hiding {
  const bodies = new Set<HiddenBody>();
  const nodes = new WeakMap<Node, Saved>();
  function hideNode(node: Node): void {
    const saved = nodes.get(node);
    if (saved) {
      saved.n++;
      return;
    }
    if (node.nodeType === 3) {
      nodes.set(node, { n: 1, v: (node as Text).data });
      (node as Text).data = '';
      return;
    }
    const style = node.nodeType === 1 ? display(node as Element) : undefined;
    if (style) {
      nodes.set(node, {
        n: 1,
        v: style.getPropertyValue('display'),
        p: style.getPropertyPriority('display'),
        a: (node as Element).hasAttribute('style'),
      });
      style.setProperty('display', 'none', 'important');
    }
  }
  function showNode(node: Node): void {
    const saved = nodes.get(node);
    if (!saved || --saved.n > 0) {
      return;
    }
    nodes.delete(node);
    if (node.nodeType === 3) {
      (node as Text).data = saved.v;
      return;
    }
    const element = node as Element;
    const style = display(element)!;
    if (saved.v) {
      style.setProperty('display', saved.v, saved.p);
    } else {
      style.removeProperty('display');
    }
    if (!saved.a && element.getAttribute('style') === '') {
      element.removeAttribute('style');
    }
  }
  return {
    bodies,
    nodes,
    hidden,
    hide(body, start, end) {
      const record: HiddenBody = { scope: body, ranges: [[start, end]] };
      body.h = record;
      bodies.add(record);
      const inside: Scope[] = [];
      for (const scope of scopes.values()) {
        if (within(scope, body)) {
          inside.push(scope);
        }
      }
      for (const scope of inside) {
        // The content of a `#portal` in the body, elsewhere in the page.
        const portal = comments.get(`P${scope.id}`);
        if (portal?.isConnected) {
          record.ranges.push([portal, rangeEnd(portal)]);
        }
      }
      for (const range of record.ranges) {
        for (const node of between(range)) {
          hideNode(node);
        }
      }
      // Effects and `$client` callbacks that ran stop, and run again when the body shows.
      for (const scope of inside) {
        for (const [name, cleanup] of scope.cleanups ?? []) {
          cleanup();
          (scope.w ??= new Set()).add(name);
        }
        scope.cleanups?.clear();
      }
    },
    show(body) {
      const record = body.h;
      if (!record) {
        return;
      }
      body.h = undefined;
      bodies.delete(record);
      for (const range of record.ranges) {
        if (range[0].isConnected) {
          for (const node of between(range)) {
            showNode(node);
          }
        }
      }
      for (const scope of scopes.values()) {
        if (scope.w && within(scope, body) && !hidden(scope)) {
          const ref = `${findRoot(scope).m}#`;
          for (const name of scope.w) {
            void call(ref + name, scope, []);
          }
          scope.w = undefined;
        }
      }
    },
    paused(scope, name) {
      if (bodies.size === 0 || !hidden(scope)) {
        return false;
      }
      (scope.w ??= new Set()).add(name);
      return true;
    },
    added(added) {
      for (const node of added) {
        for (const record of bodies) {
          for (const [start, end] of record.ranges) {
            if (
              node.parentNode === start.parentNode &&
              start.compareDocumentPosition(node) & 4 &&
              node.compareDocumentPosition(end) & 4
            ) {
              hideNode(node);
            }
          }
          // A `#portal` that renders in a hidden body, whose nodes follow its marker.
          const data = node.nodeType === 8 ? (node as Comment).data : '';
          const scope = /^P-?[\d.]+$/.test(data) ? scopes.get(parseId(data.slice(1))) : undefined;
          if (scope && within(scope, record.scope)) {
            record.ranges.push([node as Comment, rangeEnd(node as Comment)]);
          }
        }
      }
    },
    styled(element) {
      const saved = nodes.get(element);
      const style = display(element);
      if (saved && style) {
        saved.v = style.getPropertyValue('display');
        saved.p = style.getPropertyPriority('display');
        saved.a = element.hasAttribute('style');
        style.setProperty('display', 'none', 'important');
      }
    },
  };
}
