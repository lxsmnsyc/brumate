// Internal types of the generated code that checks a .brm file (src/check.ts). Not a public
// API: they can change in any release. They live here and not in the prelude of each generated
// file, so TypeScript resolves them once for the program.

import type { ElementEvents, Elements, GlobalAttributes } from 'brumate/elements';
import type { BindableMark } from 'brumate/signals';

/**
 * The attributes of the tag `T` of a dynamic tag: those of its element, or any for a custom
 * tag. A declaration with a generic `T` leaves the conditional unresolved.
 */
export type DynamicAttributes<T> = T extends keyof Elements ? Elements[T] : Record<string, unknown>;

/**
 * The attributes of a tag that can be any element or component, such as a generic
 * `T extends AsTarget`: the global ones, with a `ref` of any element, and any other name.
 */
export type AnyTagAttributes = Omit<GlobalAttributes<HTMLElement | SVGElement>, 'ref'> & {
  ref?: BindableMark<unknown>;
  [name: string]: unknown;
};

/**
 * Types a handler of a dynamic tag on the element `E`: the event of its name. Another name keeps
 * the type of the handler, and the object of the attributes checks it.
 */
export type DynamicHandle<E> = {
  <K extends keyof ElementEvents & string>(
    event: K,
    handler: (event: ElementEvents[K] & { currentTarget: E }) => unknown,
  ): (event: ElementEvents[K] & { currentTarget: E }) => unknown;
  <H>(event: string, handler: H): H;
};

/** The keys of each object of a union, so an optional key counts. */
export type SpreadKeys<U> = U extends unknown ? keyof U : never;

/**
 * Checks the props of a component as a dynamic tag. Without a spread, the props are complete.
 * With spreads, each one is part of the props, and the object must give each required prop that
 * no spread names.
 */
export type DynamicProps<P> = {
  (props: P): void;
  <S extends [Partial<P>, ...Partial<P>[]]>(
    props: Omit<P, SpreadKeys<S[number]>> & Partial<P>,
    ...spreads: S
  ): void;
};
