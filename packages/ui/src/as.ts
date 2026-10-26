// The `as` prop of the parts that render one element. It takes the name of an element or a
// component, and the other props are those of the target, as `as` of Terracotta does.

/** The name of an HTML element. */
export type ElementTag = keyof HTMLElementTagNameMap;

/**
 * A component of a `.brm` file, which the page can send to the client. Its props are `never`
 * here, so a component with any props is assignable, and `TargetProps` reads them back.
 */
export type Component = ((props: never, ...rest: never[]) => unknown) & { brumateId: string };

/** What `as` takes: the name of an element, or a component. */
export type AsTarget = ElementTag | Component;

// The fields of an element that a string, a number or a boolean can set, as the attributes of
// the element: `tabIndex` is also `tabindex`, as the markup writes it.
type Fields<T> = {
  -readonly [
    K in keyof T as K extends string
      ? T[K] extends string | number | boolean | null
        ? K | Lowercase<K>
        : never
      : never
  ]?: T[K];
};

type Handlers = {
  [K in keyof HTMLElementEventMap as `on${Capitalize<K>}`]?: (
    event: HTMLElementEventMap[K],
  ) => unknown;
};

/** The attributes of an element: its fields, `class`, `style`, handlers, `data-*` and `aria-*`. */
export type ElementProps<T extends ElementTag> = Fields<HTMLElementTagNameMap[T]> & {
  class?: string;
  style?: string;
  role?: string;
  for?: string;
  [attribute: `data-${string}`]: unknown;
  [attribute: `aria-${string}`]: unknown;
};

/**
 * The props of the target of `as`: the attributes of an element, or the props of a component. A
 * component that takes any target itself, such as a Link, takes any attribute.
 */
export type TargetProps<T> = T extends ElementTag
  ? ElementProps<T>
  : T extends (props: infer P, ...rest: never[]) => unknown
    ? [P] extends [never]
      ? { [attribute: string]: unknown }
      : P
    : never;

/**
 * The props of a part that renders its target: its own props, `as`, and the props of the target
 * that the part does not define itself. The target does not infer `T`, so `as` alone does.
 */
export type AsProps<T extends AsTarget, Own> = Own & { as?: T } & NoInfer<
    Omit<TargetProps<T>, keyof Own | 'as'> &
      (T extends ElementTag ? Omit<Handlers, keyof Own> : unknown)
  >;
