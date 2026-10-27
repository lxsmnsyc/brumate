---
name: element-types
version: 1.1
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
export type Component<P = never> = ((props: P, ...rest: any[]) => Promise<Markup>) & {
  readonly brumateId: string;
};
/** A `#template`: markup as a value, with the arguments A. */
export type Template<A extends unknown[] = []> = (...args: A) => Markup | Promise<Markup>;
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
export type GlobalAttributes<E> = Handlers<E> & { ...; ref?: BindableMark<unknown> & WritableMark<E> };
/** `onClick` for `click`, and one for each event of ElementEvents. */
export type Handlers<E> = ...;
/** A handler of the event Ev on the element E, as `event.currentTarget` reads it. */
export type EventHandler<E, Ev = Event> = (event: Ev & { currentTarget: E }) => unknown;
/** A value of `class`: a string, or an array or an object of them. */
export type ClassValue = string | false | null | undefined | readonly ClassValue[] | Readonly<Record<string, unknown>>;
/** A value of `style` as an object: camel-case names and `--` variables. */
export type StyleObject = { ... };
/** A server function that `action` and `formaction` take. */
export type ServerFunction = (...args: any[]) => Promise<unknown>;

/** The events of an element by the name of the event. An app merges custom events in. */
export interface ElementEvents extends HTMLElementEventMap {}
```

`brumate/signals` also exports `WritableMark<W>` and `BoundSignal<T>`, and `$bind` returns `BoundSignal<T>`.

## Behavior

- An attribute is in `Elements` only when HTML or SVG has it as an attribute, not every field of the DOM interface. `tabIndex` is an error, `tabindex` takes a number.
- Names are as the markup writes them, such as `tabindex`, `for`, `viewBox` and `stroke-width`.
- A handler is `on` plus the event. The markup writes it in camel case (`onKeyDown`, `onFocusIn`, `onContextLost`, `onPointerRawUpdate`) or as the event name (`onKeydown`), as the compiler lower-cases it. The event is the event of the name with `currentTarget` typed as the element. An event that the DOM does not have is added by merging into `ElementEvents`.
- Attributes with a closed set of values (`type` of `input` and `button`, `method`, `loading`) take a union. `target` takes the known names or any string. `data-*` takes any value. `aria-*` takes a string, number, boolean, `null` or `undefined`.
- `class` takes a `ClassValue`: a string, or an array or an object of them, where `false`, `0`, `0n`, `null` and `undefined` add nothing. A number is not a class value. `style` takes a string or a `StyleObject`, with camel-case names of CSS properties and `--` variables, and a value that is a string, `false`, `null` or `undefined`. A number is allowed only for the properties without a unit (`opacity`, `zIndex`, `flexGrow`, `lineHeight`, ...) and for `--` variables, since the runtime prints it with no unit.
- Number attributes (`tabindex`, `rows`, `cols`, `colspan`, `maxlength`, ...) take ``number | `${number}` ``, since a static attribute is a string.
- `value` of `input`, `select` and `textarea` and `checked` of `input` also take `$bind(name)`. The binding writes the string (`value`) or the boolean (`checked`) of the field, so the type is `BindableMark<unknown> & WritableMark<string>` or `WritableMark<boolean>`: a signal of a number is an error. `select` has `value`.
- `action` of `form` and `formaction` of `button` and `input` take a string or a `ServerFunction`. The types cannot tell a server function from another async function.
- `autocomplete` takes a boolean, which the runtime writes as `on` and `off`.
- Every attribute also takes `null` and `undefined`, which leave it out.
- SVG elements share one list of attributes, since most apply to most elements. `a`, `script`, `style` and `title` are the HTML elements, so the SVG `a` has the type of the HTML `a`.
- `Markup` is not a string, and a string is not `Markup`. The brand exists only in the type.

### `ref`

- `ref` takes `$bind(name)`, as `ref=$bind(name)` in markup. Its type is `BindableMark<unknown> & WritableMark<E>`, where the write side is required. A binding is accepted when the element `E` is assignable to the type of the signal, because the binding writes the element into the signal.
- So `$signal<HTMLElement>()` (a signal of `HTMLElement | undefined`), `$signal<Element>()`, `$signal<HTMLDivElement | null>(null)` and `any` bind the ref of a `div`. `$signal<HTMLButtonElement>()` does not: a div is not a button. A part with a generic `as` binds `HTMLElement` or `Element`.
- `BindableMark<T>` alone is covariant and cannot say this, so `$bind` returns `BoundSignal<T>`, which also has `WritableMark<T>`: a required property that is a function of `T`, so it is contravariant. A bare `BindableMark` of any type, such as `BindableMark<HTMLButtonElement>`, has no write side and is not a `ref`. A `Bindable<T>` prop still takes `$bind(x)` as before, and a type error names `BoundSignal<T>`.
- A part forwards its own ref: `let { ref } = $props<{ ref?: Bindable<HTMLElement> }>()`, then `ref=$bind(ref)`. A part that holds a `Bindable<HTMLButtonElement>` cannot forward it to a `div`.
- check.ts does not check `ref` yet: it writes `$$use(name)` for it (check.ts, `elementAttributes`). element-checks must emit `{ ref: $bind(name) }` against `ElementProps<tag>` to check it.

### Components and templates

- `Component<P>` answers `Promise<Markup>`, because a component renders on the server, and has `brumateId`, which `$$Sendable` needs to send a component to the client. A function without `brumateId` is not a `Component`.
- The default `P` is `never`. A component of any props is assignable to `Component`, so use it for a constraint, a parameter or `AsTarget` (as-sound). A call through it, or `PropsOf` of it, gives `never`: `Component({ nonsense: 1 })` is an error. Where code must call a component of unknown props, write `Component<any>`. A `.brm` import is `Component<any>` in types.d.ts, and the plugin gives it its real props.
- `Template<A>` takes a sync or an async function, since a template can await a memo. check.ts types each `#template` as an `async function` that answers `Promise<Markup>`, and a prop `item: Template<[V]>` takes it. A generic `V` is inferred from the other props, such as `items`, and reaches the template, so `(item) => item.nam` is an error.
- check.ts and types.d.ts now give `Promise<Markup>` for the generated component, and types.d.ts types a `.brm` import as `Component<any>`. The generated `brumateId` stays. The server `Component` type of the runtime (`brumate/server`) takes `Promise<string | object>`, so `mount` and `render` take both a compiled component and a hand-written one that answers a string.

### Checks of the file itself

- skipLibCheck hides an error inside `elements.d.ts`. The `typecheck` script of packages/brumate also runs `tsc --noEmit -p tsconfig.elements.json` (`types: []`, `skipLibCheck: false`, `files: [elements.d.ts]`). A typo such as `Attr<Referrr>` fails it, and passes the main config.
- The `ref` type imports `BindableMark` and `WritableMark` from `brumate/signals`, so a typecheck of the package needs `dist`, as `types.d.ts` already needs it.

## Stub

None. The nodes after it start from the names above.

## Contract tests

packages/brumate/test/elements-types.ts, checked by `tsc --noEmit -p .` in packages/brumate. It has 33 `@ts-expect-error` lines, and each one fails when its comment is removed. It covers `ref` (a supertype binds, a wrong subtype and a bare mark do not, a part forwards its prop), templates (sync, async, inferred argument), `brumateId`, and the `never` default.

## Changes

- v1.1, element-values (change request accepted on 2026-10-27): `class` takes `ClassValue` and `style` takes `string | StyleObject`; `select` has `value`; `value` and `checked` of `input`, `select` and `textarea` take a binding; `form action` and `formaction` take a `ServerFunction`; number attributes take ``number | `${number}` ``; `autocomplete` takes a boolean; `onToggleEnd` is removed (lib.dom has no such event) and `onKeyPress` is added; `EventHandler`, `ClassValue`, `StyleObject` and `ServerFunction` are exported. Review fixes: a number in a style object only for unitless properties and variables, and `0` and `0n` are class values that add nothing. Each value is checked against the runtime in nodes/element-values/log.md.
- v1, second review: the write side of `ref` is required, `BoundSignal<T>` is the return type of `$bind`.
- v1, review fixes: `ref` is `BindableMark<unknown> & WritableMark<E>`; added `Template`; `Component` has `brumateId` and defaults to `never`; check.ts, types.d.ts and the typecheck script changed as above; added the camel events `onContextLost`, `onContextRestored` and `onPointerRawUpdate`.
- v1: frozen by element-types. From the proposal it changes: `Component<P>` answers `Promise<Markup>` and defaults to `never`; `Elements` has the SVG tags; added `ElementOf`, `ElementEvents`, `Handlers` and `GlobalAttributes`; `Markup` and `Component` names are kept.
