// Wrappers for event handlers that act before the handler's code loads. The
// compiler reads the calls in markup and writes them into `b-on`, so the
// loader applies them on the first event. At run time, each returns a copy of
// the handler that carries its modifiers, so a handler passed on as a prop
// keeps them.

/** The keys that `prevent` can name, by their `event.key`. `Space` is the space bar. */
export const KEY_NAMES: readonly string[] = [
  'Enter',
  'Escape',
  'Tab',
  'Space',
  'Backspace',
  'Delete',
  'Insert',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ContextMenu',
  ...Array.from({ length: 12 }, (_, index) => `F${index + 1}`),
];

type Letter =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z';
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type FunctionKey = `F${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`;

/**
 * A key of `prevent`: a key by its `event.key`, or that key with a modifier that must be held,
 * such as `Mod+ArrowDown`. A key alone matches only while Ctrl, Meta and Alt are up, so the
 * shortcuts of the browser, such as Cmd+Left or Alt+Left, keep their default. `Mod` is Ctrl or
 * Meta.
 */
export type KeyName = Key | `${'Mod' | 'Ctrl' | 'Meta' | 'Alt'}+${Key}`;

/** A key by its `event.key`: a named key, a letter or a digit. */
type Key =
  | 'Enter'
  | 'Escape'
  | 'Tab'
  | 'Space'
  | 'Backspace'
  | 'Delete'
  | 'Insert'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown'
  | 'ContextMenu'
  | FunctionKey
  | Letter
  | Uppercase<Letter>
  | Digit;

/** The modifiers of a handler, which `spread` writes into `b-on`. A symbol of the registry. */
export const MODIFIERS: unique symbol = Symbol.for('brumate.modifiers');

/** A handler with the modifiers of its wrappers. */
// oxlint-disable-next-line typescript/no-explicit-any -- Handlers take any event.
type Handler = (...args: any[]) => unknown;

function tagged<H extends Handler>(handler: H, modifier: string): H {
  const copy = ((...args: unknown[]) => handler(...args)) as H & { [MODIFIERS]?: string[] };
  copy[MODIFIERS] = [...((handler as { [MODIFIERS]?: string[] })[MODIFIERS] ?? []), modifier];
  return copy;
}

/**
 * Prevents the default action of the event, before the handler's code
 * loads. With keys, on a keyboard event, it prevents only those keys, and
 * the handler still runs for every key.
 */
export function prevent<H extends Handler>(handler: H, ...keys: KeyName[]): H {
  return tagged(handler, keys.length > 0 ? `prevent(${keys.join(',')})` : 'prevent');
}

/** Stops the event at this element, so the handlers of the elements around it do not run. */
export function stop<H extends Handler>(handler: H): H {
  return tagged(handler, 'stop');
}

/** Runs the handler for the first event only. */
export function once<H extends Handler>(handler: H): H {
  return tagged(handler, 'once');
}

/** Waits for the updates that writes started, such as those whose code is loading. A symbol of the registry. */
const UPDATED = Symbol.for('brumate.updated');

/**
 * Runs the handler inside a view transition, so the browser animates the
 * change of the page, such as an element that `#if` removes or a list that
 * changes order. CSS styles the animation, with `view-transition-name` and
 * `::view-transition-*`.
 *
 * - The transition holds the writes that the handler makes before its first
 *   `await`. Writes after it, such as after a server call, change the page
 *   without an animation.
 * - `types` are the types of the transition, which `:active-view-transition-type()`
 *   matches in CSS.
 * - Without view transitions, or with `prefers-reduced-motion`, the handler
 *   runs as it is.
 */
export function transition<H extends Handler>(handler: H, ...types: string[]): H {
  const copy = ((...args: unknown[]): unknown => {
    if (
      typeof document === 'undefined' ||
      typeof document.startViewTransition !== 'function' ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return handler(...args);
    }
    let result: unknown;
    const update = (): unknown => {
      result = handler(...args);
      // The page shows the new state once the updates of the writes have run.
      return (globalThis as { [UPDATED]?: () => Promise<void> })[UPDATED]?.();
    };
    // Browsers that have transitions without types take only a callback.
    const started =
      types.length > 0 &&
      typeof ViewTransition !== 'undefined' &&
      'types' in ViewTransition.prototype
        ? document.startViewTransition({ update, types })
        : document.startViewTransition(update);
    return started.updateCallbackDone.then(() => result);
  }) as H & { [MODIFIERS]?: string[] };
  const modifiers = (handler as { [MODIFIERS]?: string[] })[MODIFIERS];
  if (modifiers) {
    copy[MODIFIERS] = modifiers;
  }
  return copy;
}

/** Runs the handler before the handlers of the elements inside, as a listener in the capture phase. */
export function capture<H extends Handler>(handler: H): H {
  return tagged(handler, 'capture');
}

/** A symbol of the registry, under which the loader registers `cancelWhen`. */
const CANCEL = Symbol.for('brumate.cancel');

/** The events that `cancelWhen` can cancel. Scroll-type events cannot be, for their listeners are passive. */
export type CancelableEvent = 'click' | 'submit';

/**
 * Cancels an event of the element, or of an element inside it, before any handler of brumate
 * runs, while `check` returns true. The document listener of brumate calls `preventDefault()` and
 * runs no brumate handler for the event. It does not stop the event, so listeners that were added
 * with `addEventListener` still run, and they can read `event.defaultPrevented`.
 *
 * Returns a function that removes the check.
 *
 * ```ts
 * const stop = cancelWhen(form, 'submit', () => form.hasAttribute('data-pending'));
 * ```
 */
export function cancelWhen<T extends CancelableEvent>(
  element: Element,
  type: T,
  check: (event: HTMLElementEventMap[T]) => boolean,
): () => void {
  const register = (globalThis as { [CANCEL]?: typeof cancelWhen })[CANCEL];
  return register ? register(element, type, check) : () => {};
}
