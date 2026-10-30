// Reports an error of client code to the nearest `#try`.

import { MARKER, blockStart, findComment, rangeEnd } from './blocks.ts';
import type { Render } from './branches.ts';
import { loadModule, loadPart } from './code.ts';
import { insertHTML } from './insert.ts';
import { inPlace, removeBlock, rootOf } from './scopes.ts';
import { options, scopes } from './state.ts';
import { parseId } from '../shared.ts';
import type { ClientModule, Scope } from './state.ts';

/**
 * Reports an error of client code: a handler, an effect, a `$client`
 * callback or a memo that loads. It renders the `#catch` body of the nearest
 * `#try` around the scope of the code, through the parents and the owners of
 * scopes. Without one, the page gets a `brumate:error` event on `window`,
 * with the error and the scope, and the error is logged.
 */
export function fail(scope: Scope | undefined, error: unknown): void {
  options.onError?.(error, { scope: scope?.id });
  void (async () => {
    for (let current = scope; current; current = current.p ?? current.o) {
      const id = rootOf(current).m;
      if (!id) {
        continue;
      }
      // A component whose code fails to load, which can be the error itself, cannot render its
      // `#catch`, so a `#try` further out catches the error.
      // oxlint-disable-next-line no-await-in-loop -- Each scope can belong to another component.
      const module = await loadModule(id).catch(() => undefined);
      const entry = module?.t?.[current.k];
      if (!entry) {
        continue;
      }
      // The scope that holds the block, which the anchor of the block counts from.
      let owner = current.p;
      while (owner && owner.k !== entry[0]) {
        owner = owner.p;
      }
      if (owner) {
        // oxlint-disable-next-line no-await-in-loop -- The first `#try` found catches the error.
        await catchInto(owner, module!, entry, error);
        return;
      }
    }
    unhandled(error, scope);
  })();
}

/** Tells the page about an error that no `#try` caught. */
function unhandled(error: unknown, scope?: Scope): void {
  window.dispatchEvent(new CustomEvent('brumate:error', { detail: { error, scope } }));
  console.error(error);
}

/**
 * Shows the `#catch` body that the server rendered, in the template `b-c`, in place of the body
 * of a `#try`. The server sends it when a `#loading` body inside the `#try` failed. `key` is the
 * scope and the anchor of the block.
 */
export function replaceTry(key: string): void {
  const template = document.querySelector(`template[b-c="${key}"]`);
  const [id, anchor] = key.split(':') as [string, string];
  const owner = scopes.get(parseId(id));
  const start = owner && blockStart(owner, Number(anchor));
  if (template && start) {
    const end = rangeEnd(start);
    removeBlock(owner, [], start, end);
    insertHTML(end, (template as HTMLTemplateElement).innerHTML);
  }
  template?.remove();
}

/** The start markers of the blocks around a node, from the inside out. */
function blocksAround(place: Node): Comment[] {
  const result: Comment[] = [];
  for (let up: Node | null = place; up; up = up.parentNode) {
    let depth = 0;
    for (let node = up.previousSibling; node; node = node.previousSibling) {
      const data = node.nodeType === 8 ? (node as Comment).data : '';
      if (data[0] === '/') {
        depth++;
      } else if (MARKER.test(data)) {
        if (depth === 0) {
          result.push(node as Comment);
        } else {
          depth--;
        }
      }
    }
  }
  return result;
}

/**
 * Reports the error of a `#loading` body that failed on the server. The body never arrives, so
 * the blocks around its boundary come from the markers in the page. The first `#try` among them
 * with a `#catch` body in the browser renders it.
 */
export function failBoundary(id: string, error: unknown): void {
  options.onError?.(error, {});
  const place = findComment(`l${id}`);
  void (async () => {
    for (const marker of place ? blocksAround(place) : []) {
      if (marker.data[0] !== 'b') {
        continue;
      }
      const [owner, anchor] = marker.data.slice(1).split(':') as [string, string];
      const scope = scopes.get(parseId(owner));
      // oxlint-disable-next-line no-await-in-loop -- The first `#try` found catches the error.
      const module = scope && (await loadModule(rootOf(scope).m ?? '').catch(() => undefined));
      const entry = Object.values(module?.t ?? {}).find(
        (item) => item[0] === scope!.k && item[1] === Number(anchor),
      );
      if (entry) {
        // oxlint-disable-next-line no-await-in-loop -- It is the last one.
        await catchInto(scope!, module!, entry, error);
        return;
      }
    }
    unhandled(error);
  })();
}

/** Renders the `#catch` body of a `#try` with an error, in place of what the block shows. */
async function catchInto(
  owner: Scope,
  module: ClientModule,
  [, anchor, , fallback, kinds, holderKind, holderAnchor]: NonNullable<ClientModule['t']>[number],
  error: unknown,
): Promise<void> {
  const updates = await loadPart(module, 'update');
  const start = blockStart(owner, anchor);
  if (!start) {
    return;
  }
  const end = rangeEnd(start);
  removeBlock(owner, kinds, start, end);
  const render = inPlace(owner, updates[fallback] as Render, holderKind, holderAnchor)!;
  insertHTML(end, (render as unknown as (parent: Scope, error: unknown) => string)(owner, error));
}
