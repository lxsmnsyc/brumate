// The `as` prop of the parts that render one element. It takes the name of an element or a
// component, and the other props are those of the target, as `as` of Terracotta does. The element
// and component types are those of `brumate/elements`.

import type { Component, ElementOf, ElementProps, Elements, PropsOf } from 'brumate/elements';
import type { BindableMark } from 'brumate/signals';

export type { Component, ElementProps };

/** The name of an HTML or SVG element. */
export type ElementTag = keyof Elements;

/** What `as` takes: the name of an element, or a component. */
export type AsTarget = ElementTag | Component;

/**
 * The props of the target of `as`: the attributes of an element, or the props of a component. A
 * component that takes any target itself, such as a Link, takes any attribute.
 */
export type TargetProps<T> = T extends ElementTag
  ? ElementProps<T>
  : T extends Component<any>
    ? [PropsOf<T>] extends [never]
      ? { [attribute: string]: unknown }
      : PropsOf<T>
    : never;

/**
 * The props of a part that renders its target: its own props, `as`, and the props of the target
 * that the part does not define itself. The target does not infer `T`, so `as` alone does.
 */
export type AsProps<T extends AsTarget, Own> = Own & { as?: T } & NoInfer<
    Omit<TargetProps<T>, keyof Own | 'as'>
  >;

/** The element that a component binds to its own `ref`: `Bindable<E>` gives `E`, else `Element`. */
type ComponentElement<P> = [P] extends [never]
  ? Element
  : 0 extends 1 & P
    ? Element
    : P extends { ref?: infer R }
      ? [Extract<R, BindableMark<any>>] extends [never]
        ? Element
        : Extract<R, BindableMark<any>> extends BindableMark<infer E>
          ? Exclude<E, undefined> extends never
            ? Element
            : Exclude<E, undefined>
          : Element
      : Element;

/**
 * The element that the target of `as` renders, which is the type of the `ref` of the part. An
 * element name gives its element, `a` gives `HTMLAnchorElement`. A component gives the element of
 * its own `ref`, and `Element` when its `ref` is not typed.
 */
export type TargetElement<T> = T extends ElementTag
  ? ElementOf<T>
  : T extends Component<any>
    ? ComponentElement<PropsOf<T>>
    : Element;
