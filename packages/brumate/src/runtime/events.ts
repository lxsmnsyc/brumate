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

/** A key by its `event.key`: a named key, a letter or a digit. */
export type KeyName =
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

/** Runs the handler before the handlers of the elements inside, as a listener in the capture phase. */
export function capture<H extends Handler>(handler: H): H {
  return tagged(handler, 'capture');
}
