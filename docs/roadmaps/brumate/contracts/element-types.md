---
name: element-types
version: 1
status: draft
defined_by: element-types
---

# Contract: element-types

## Purpose

The types of brumate for elements, markup and components, as JSX gives `JSX.IntrinsicElements`, `JSX.Element` and component types. element-checks checks plain elements against them, as-sound rebuilds as.ts on them, and ui-generics types the templates of the parts with `Markup`.

## Interface

To be frozen by element-types. Proposed names, exported from `brumate/elements`:

```ts
/** The attributes of each element, by tag: its attributes, `class`, `style`, handlers, `data-*`, `aria-*`, `ref` and spreads. */
export interface Elements {
  a: AnchorAttributes;
  button: ButtonAttributes;
  // … every HTML and SVG element
}
/** The attributes of an element by its tag. */
export type ElementProps<T extends keyof Elements> = Elements[T];
/** What children, a `#template` and a render give. Opaque: not a string. */
export interface Markup {
  readonly [MARKUP]: true;
}
/** A component of a .brm file with props P. */
export type Component<P = Record<string, unknown>> = (props: P) => Markup;
/** The props of a component. */
export type PropsOf<C> = C extends Component<infer P> ? P : never;
```

## Behavior

- An attribute is in `Elements` only when HTML has it as an attribute, not every field of the DOM interface.
- Names are as the markup writes them, such as `tabindex` and `for`.
- `Component<P>` is the type of a default import of a .brm file, through the TypeScript plugin.

## Stub

None. The nodes after it start once the names are frozen.

## Contract tests

packages/brumate/test/elements-types.ts.

## Changes

- v1: draft, from the request of the user on 2026-10-26.
