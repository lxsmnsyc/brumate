// Reports an error of client code to the nearest `#try`.

import { blockStart, rangeEnd } from './blocks.ts';
import type { Render } from './branches.ts';
import { loadModule, loadPart } from './code.ts';
import { insertHTML } from './insert.ts';
import { inPlace, removeBlock, rootOf } from './scopes.ts';
import { options } from './state.ts';
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
    window.dispatchEvent(new CustomEvent('brumate:error', { detail: { error, scope } }));
    console.error(error);
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
