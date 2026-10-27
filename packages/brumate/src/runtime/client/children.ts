// Children, and the calls of `#template` values: markup that renders where it is inserted.

import { HAS_CHILDREN, HAS_CLIENT_HTML, HAS_TEMPLATES } from '../features.ts';
import { insertValue } from '../html.ts';
import type { ScopeId } from '../shared.ts';
import { loadedFunction } from './code.ts';
import { holdPlace, insertHTML } from './insert.ts';
import { resolve } from './references.ts';
import type { Handler } from './references.ts';
import { resolveScope } from './scopes.ts';
import { insertedChildren } from './state.ts';
import type { Scope } from './state.ts';

/**
 * A `#template` of another component, which renders at once, as markup does. Its code loads
 * with the page, and updates wait for it.
 */
export function templateReference(
  ref: string,
  scope: Scope | undefined,
): (...args: unknown[]) => unknown {
  // The markup renders where the component inserts it, so it reads the contexts there, as
  // children do.
  return (...args) =>
    new TemplateCall(ref, scope, args, () => {
      const render = loadedFunction(ref);
      return render ? insertValue(render(scope, ...args)) : '';
    });
}

// Rendering on the client

/** Renders a value inserted in markup. Children render here, at `scope`, for their contexts. */
export function insert(value: unknown, _ctx?: unknown, scope?: Scope | ScopeId): string {
  if (!((HAS_CHILDREN || HAS_TEMPLATES) && value instanceof Children)) {
    return insertValue(value);
  }
  const out = value.render(resolveScope(scope));
  return HAS_CLIENT_HTML ? holdPlace(out) : (out as string);
}

/**
 * Children of a component that the client renders. They render where the
 * component inserts them, so they read the contexts that it provides. `from`
 * is the scope of the markup that wrote them.
 */
export class Children {
  private given: Scope | ScopeId | undefined;
  private readonly html: () => string | DocumentFragment;

  constructor(from: Scope | ScopeId | undefined, html: () => string | DocumentFragment) {
    this.given = from;
    this.html = html;
  }

  /** The scope that the children were written in, found when they render. */
  protected get from(): Scope | undefined {
    const scope = resolveScope(this.given);
    if (scope) {
      this.given = scope;
    }
    return scope;
  }

  render(at: Scope | undefined): string | DocumentFragment {
    if (!at) {
      return this.html();
    }
    // Children that a component passes on render where the component that gets them inserts
    // them, so they find their contexts there too.
    let target = at;
    for (let index = insertedChildren.length - 1; index >= 0; index--) {
      if (insertedChildren[index]!.from === at) {
        target = insertedChildren[index]!.at;
        // A block in these children finds the component that holds them by this.
        at.f = target;
        break;
      }
    }
    const entry = { from: this.from, at: target };
    insertedChildren.push(entry);
    try {
      return this.html();
    } finally {
      insertedChildren.splice(insertedChildren.indexOf(entry), 1);
    }
  }
}

/** A call of a `#template` of another component, which an insert can update in place. */
export class TemplateCall extends Children {
  readonly ref: string;
  /** The scope of the component that wrote the template. */
  readonly owner: Scope | undefined;
  readonly args: unknown[];

  constructor(ref: string, owner: Scope | undefined, args: unknown[], html: () => string) {
    super(owner, html);
    this.ref = ref;
    this.owner = owner;
    this.args = args;
  }
}

/**
 * Children that the server rendered, which the browser renders with their own export each time
 * a component inserts them, so each insert makes new scopes, as the body of a block does. The
 * code of the export loads before the code that can insert them runs. See `childrenReady`.
 */
export class RenderedChildren extends Children {
  readonly ref: string;
  /** The scope and the anchor of the insert where the server rendered them, if it did. */
  readonly at: ScopeId | undefined;
  readonly anchor: number | undefined;
  private code: Handler | undefined;
  private loading: Promise<void> | undefined;

  constructor(scope: ScopeId, ref: string, at?: ScopeId, anchor?: number) {
    // The export returns HTML, as the render of a block does.
    super(scope, () => {
      const out = this.code!(this.from);
      return out instanceof DocumentFragment ? out : String(out);
    });
    this.ref = ref;
    this.at = at;
    this.anchor = anchor;
  }

  override render(at: Scope | undefined): string | DocumentFragment {
    if (this.code && this.from) {
      return super.render(at);
    }
    // An insert that ran before the code, such as an update that a parent ran at once, or before
    // the state of its scope, such as markup of a page that navigation is still reading. A marker
    // holds the place, and the children render there once both are ready, where they were
    // inserted, so they read the contexts there.
    const marker = `C${(nextChildren += 1)}`;
    const fill = (tries: number): void => {
      const node = findMarker(marker);
      if (!node) {
        return;
      }
      if (!this.from) {
        if (tries > 0) {
          setTimeout(() => fill(tries - 1), 0);
        }
        return;
      }
      insertHTML(node, super.render(at));
      node.remove();
    };
    void this.load().then(() => fill(100));
    return `<!--${marker}-->`;
  }

  get loaded(): boolean {
    return this.code !== undefined;
  }

  load(): Promise<void> {
    this.loading ??= resolve(this.ref).then((handler) => {
      this.code = handler;
    });
    return this.loading;
  }
}

/** The count of the markers of children that wait for their code. */
let nextChildren = 0;

/** The comment of a marker, such as of children that wait for their code. */
function findMarker(data: string): Comment | undefined {
  const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if ((node as Comment).data === data) {
      return node as Comment;
    }
  }
  return undefined;
}

/**
 * Loads the code of the children that the scope, or a component around it, holds, so code that
 * runs in the scope can insert them at once. Undefined when there is nothing to load.
 */
export function childrenReady(scope: Scope | undefined): Promise<unknown> | undefined {
  if (!HAS_CHILDREN) {
    return undefined;
  }
  const waiting: Promise<void>[] = [];
  const seen = new Set<Scope>();
  for (let current = scope; current && !seen.has(current); current = current.p ?? current.o) {
    seen.add(current);
    for (const value of current.s) {
      if (value instanceof RenderedChildren && !value.loaded) {
        waiting.push(value.load());
      }
    }
  }
  return waiting.length > 0 ? Promise.allSettled(waiting) : undefined;
}

/** The children of a component that the client renders. See `Children`. */
export function children(
  from: Scope | ScopeId | undefined,
  html: () => string | DocumentFragment,
): Children {
  return new Children(from, html);
}
