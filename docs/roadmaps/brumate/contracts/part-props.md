---
name: part-props
version: 1.3
status: frozen
defined_by: props-types-main
---

# Contract: part-props

## Purpose

How a part of @brumate/ui exports its props, takes `as`, and forwards `ref`. The nodes that add `as` to more parts (as-controls, as-collections) and the props table generator (docs-generator) build against it.

## Interface

```brm
<script module>
  import type { Bindable } from 'brumate/signals';
  import type { AsProps, AsTarget } from './as.ts';

  export interface LinkOwnProps {
    href?: string;
    /** A doc comment on a prop becomes its description in the props table. */
    isDisabled?: boolean;
    /** The element, bound with `ref=$bind(signal)`. */
    ref?: Bindable<HTMLElement | undefined>;
    children?: unknown;
  }

  export type LinkProps<T extends AsTarget = 'a'> = AsProps<T, LinkOwnProps>;
</script>

<script generics="T extends AsTarget = 'a'">
  import { $props } from 'brumate/signals';

  const { as, href, isDisabled, children, ...rest } = $props<LinkProps<T>>();
  let { ref } = $props<LinkOwnProps>();
</script>

<{as ?? 'a'} ref=$bind(ref) {href} {...rest}>{children}</>
```

- A part with `as` exports `<Name>OwnProps`, its own props, and `<Name>Props<T>`, which adds the target's. The props table reads `<Name>OwnProps`.
- A part without `as` exports `<Name>Props` as one interface, and keeps `[attribute: string]: unknown` when it spreads attributes onto its element.
- `AsTarget`, `TargetProps` and `AsProps` are in packages/ui/src/as.ts.
- A part forwards `ref` with a `ref?: Bindable<HTMLElement | undefined>` in its own props and `ref=$bind(ref)` on its root (#243). The own prop wins over the target's, and a caller's `$signal<HTMLElement>()` fits it.

## Behavior

- With an element name in `as`, the props are the part's own props and the attributes of that element.
- With a component in `as`, the props are the part's own props and the props of the component. The component must forward `ref` for the part to get its element.
- A part's own props win over the target's.
- A part that reads its own root uses the `ref` prop as its root signal: `let { ref } = $props<LinkOwnProps>()`, then `ref=$bind(ref)` on the root, and the code reads `ref` where it read its own signal. With nothing bound, `ref` is a local value, so the part works alone. An element never has two `ref` bindings.

## Stub

None needed: the types and Link, Button and Heading on main (after #245) are the reference.

## Contract tests

packages/ui/test/props-types.ts, checked by `pnpm --filter @brumate/ui typecheck`.

## Changes

- v1.3 (as-controls, accepted 2026-10-27): `ref` is declared in the own props as `Bindable<HTMLElement | undefined>`. The old `Bindable<HTMLElement>` rejected a caller's `$signal<HTMLElement>()`, and an element target has no `ref` prop. as-controls uses it; ref-type-parts applies it to the collection parts, Link, Button and Heading.
- v1.2 (as-sound): as.ts reads `Elements`, `ElementProps` and `Component` of `brumate/elements`. The names and type parameters of `AsTarget`, `TargetProps` and `AsProps` are unchanged, so the version stays 1. `ElementTag` now includes SVG tags. A field that is not an attribute is an error.
- v1: from #242 (as #245) and #243.
- v1.1: `<Name>OwnProps` for parts with `as`, and the rule for a part that reads its own root (from the adversarial review).
