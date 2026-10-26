---
name: element-types
version: 1
status: frozen
defined_by: element-types
---

# Contract: element-types

## Purpose

The types of brumate for elements, markup and components, as JSX gives `JSX.IntrinsicElements`, `JSX.Element` and component types. element-checks checks plain elements against them, as-sound rebuilds as.ts on them, and ui-generics types the templates of the parts with `Markup`.

## Interface

Exported from `brumate/elements` (packages/brumate/elements.d.ts, listed in `exports` and `files` of package.json). Types only, no runtime code.

```ts
/** What children, a `#template` and a render give. Opaque: not a string. */
export interface Markup {
  readonly [MARKUP]: true;
}
/** A component of a .brm file with props P. It renders on the server, so it answers a promise. */
export type Component<P = any> = (props: P, ...rest: any[]) => Promise<Markup>;
/** The props of a component. */
export type PropsOf<C> = C extends (props: infer P, ...rest: any[]) => unknown ? P : never;

/** The attributes of each element, by tag. HTML and SVG elements. An app merges its own tags in. */
export interface Elements {
  a: ...;
  button: ...;
  // every tag of HTMLElementTagNameMap and SVGElementTagNameMap
}
/** The attributes of an element by its tag. */
export type ElementProps<T extends keyof Elements> = Elements[T];
/** The element object of a tag, as `event.currentTarget` reads it. */
export type ElementOf<T extends keyof Elements> = ...;

/** The attributes of every element: `class`, `style`, handlers, `ref`, `data-*`, `aria-*` and the global HTML ones. */
export type GlobalAttributes<E> = Handlers<E> & { ...; ref?: BindableMark<E | null> };
/** `onClick` for `click`, and one for each event of ElementEvents. */
export type Handlers<E> = ...;
/** The events of an element by the name of the event. An app merges custom events in. */
export interface ElementEvents extends HTMLElementEventMap {}
```

## Behavior

- An attribute is in `Elements` only when HTML or SVG has it as an attribute, not every field of the DOM interface. `tabIndex` is an error, `tabindex` takes a number.
- Names are as the markup writes them, such as `tabindex`, `for`, `viewBox` and `stroke-width`.
- A handler is `on` plus the event. The markup writes it in camel case (`onKeyDown`, `onFocusIn`) or as the event name (`onKeydown`), as the compiler lower-cases it. The event is the event of the name with `currentTarget` typed as the element. An event that the DOM does not have is added by merging into `ElementEvents`.
- `ref` takes `$bind(name)` of the element: `BindableMark<E | null>`.
- Attributes with a closed set of values (`type` of `input` and `button`, `method`, `loading`) take a union. `target` takes the known names or any string. `data-*` takes any value. `aria-*` takes a string, number, boolean, `null` or `undefined`.
- Every attribute also takes `null` and `undefined`, which leave it out.
- SVG elements share one list of attributes, since most apply to most elements. `a`, `script`, `style` and `title` are the HTML elements.
- `Markup` is not a string, and a string is not `Markup`. The brand exists only in the type.
- `Component<P>` answers `Promise<Markup>`, because a component renders on the server. Its default `P` is `any`, so a component of any props is assignable to `Component`. A generic `Record<string, unknown>` default would reject them.
- `Component<P>` is the type of a default import of a .brm file, once the nodes after this one switch `types.d.ts` and `check.ts` to it. This node does not change them: a .brm import is still `(props: any, ctx) => Promise<string>`.
- The `ref` type imports `BindableMark` from `brumate/signals`, so a typecheck of the package needs `dist`, as `types.d.ts` already needs it.

## Stub

None. The nodes after it start from the names above.

## Contract tests

packages/brumate/test/elements-types.ts, checked by `tsc --noEmit -p .` in packages/brumate. It has 14 `@ts-expect-error` lines, and each one fails when its comment is removed.

## Changes

- v1: frozen by element-types. From the proposal it changes: `Component<P>` answers `Promise<Markup>` and defaults to `any`; `Elements` has the SVG tags; added `ElementOf`, `ElementEvents`, `Handlers` and `GlobalAttributes`; `Markup` and `Component` names are kept.
