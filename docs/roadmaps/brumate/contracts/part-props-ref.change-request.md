# Change request: part-props v1.2 to v1.3

- From node: as-controls
- Status: accepted

## Problem

The contract types the forwarded ref as `let { ref } = $props<{ ref?: Bindable<HTMLElement> }>()`. Two things fail with it in packages/ui, checked with `node ../tsc/bin/brumate-tsc.js --noEmit`:

- A caller's signal is `$signal<HTMLElement>()`, which is `HTMLElement | undefined`. `ref=$bind(signal)` on a part is then an error: `BoundSignal<HTMLElement | undefined>` is not assignable to `Bindable<HTMLElement>`.
- `ref` is a prop of the target of `as`, not of the part. With an element name in `as`, or none, `ElementProps` has no `ref`, so `<Toolbar ref=$bind(x)>` is an error. With a component, the type is the one that the component declares.

A second type error remains in the core: `$signal<HTMLElement>()` that a component binds fails with "Argument of type HTMLElement is not assignable to ...", because the check of a signal that is bound to a prop takes an element for data that the server cannot send. The same signal on an element's `ref` passes.

## Proposed change

A part with a forwarded ref declares it in its own props, so it wins over the target's:

```ts
export interface LinkOwnProps {
  /** The element, bound with `ref=$bind(signal)`. */
  ref?: Bindable<HTMLElement | undefined>;
}
```

and reads it with `let { ref } = $props<LinkOwnProps>()`.

## Affected nodes

as-collections, as-sound, docs-generator (the props table gets a `ref` row), visible-forwarded-ref, Link, Button and Heading.

## Workaround in place

as-controls declares `ref?: Bindable<HTMLElement | undefined>` in the own props of its 15 parts. Its test fixture types the signals that components bind as `$signal<any>()`, because of the check of the core above.

## Decision

Accepted by the maintainer on 2026-10-27, as part-props v1.3. The node ref-type-parts applies it to the parts that as-collections rewrote, and to Link, Button and Heading. The second error, in the check of the core, is the node bound-element-signal.
