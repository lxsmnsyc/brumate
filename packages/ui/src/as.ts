// The `as` prop of the parts that render one element. It takes the name of an element or a
// component, and the other props are those of the target, as `as` of Terracotta does. The element
// and component types are those of `brumate/elements`.

import type { Component, ElementProps, Elements, PropsOf } from 'brumate/elements';

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
