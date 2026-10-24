// Context composition with slots, after useContextProps of React Aria. A part that holds other
// parts, such as a Select, provides the props of each part type in a context. A context value is
// the props of the part, or `{ slots }`, the props of each slot. A part with `slot="increment"`
// reads the props of that slot.

/** The value of the context of a part type: its props, or the props of each of its slots. */
export type ContextValue<T> = T | { slots: Record<string, T> };

/** The name of the slot of a part that names no slot. */
export const DEFAULT_SLOT = 'default';

/**
 * The props that a context gives a part with a slot. `null` and `undefined` give nothing. A slot
 * that the context does not have is an error, as it is in React Aria, so a typo does not go
 * unseen. `slot={null}` opts out of the context.
 */
export function slotProps<T extends object>(
  value: ContextValue<T> | null | undefined,
  slot: string | null | undefined,
): Partial<T> {
  if (value == null || slot === null) {
    return {};
  }
  if (!('slots' in value)) {
    return value;
  }
  const name = slot ?? DEFAULT_SLOT;
  const found = value.slots[name];
  if (!found) {
    const names = Object.keys(value.slots).map((key) => `"${key}"`);
    throw new Error(
      slot === undefined
        ? `A slot prop is needed. Valid names are ${names.join(', ')}.`
        : `The slot "${slot}" is not valid. Valid names are ${names.join(', ')}.`,
    );
  }
  return found;
}

/** Calls each handler that is a function, in order, as mergeProps of React Aria chains them. */
export function chain<A extends unknown[]>(
  ...handlers: (((...args: A) => unknown) | undefined | null | false)[]
): (...args: A) => void {
  return (...args: A) => {
    for (const handler of handlers) {
      if (typeof handler === 'function') {
        handler(...args);
      }
    }
  };
}

/** True for a prop of a part that is no attribute: a handler, a state such as `isDisabled`, or a slot. */
function isPartProp(name: string): boolean {
  return /^(on|is)[A-Z]/.test(name) || name === 'slot' || name === 'slots' || name === 'children';
}

/** The attributes of the props that a context gives, such as `aria-expanded` and `id`. */
export function contextAttributes(props: object): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(props)) {
    if (!isPartProp(name)) {
      result[name] = value;
    }
  }
  return result;
}
