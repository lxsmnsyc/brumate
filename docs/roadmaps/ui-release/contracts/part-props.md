---
name: part-props
version: 1
status: frozen
defined_by: props-types-main
---

# Contract: part-props

## Purpose

How a part of @brumate/ui exports its props, takes `as`, and forwards `ref`. The nodes that add `as` to more parts (as-controls, as-collections) and the props table generator (docs-generator) build against it.

## Interface

```brm
<script module>
  import type { AsProps, AsTarget } from './as.ts';

  export interface LinkOwnProps {
    href?: string;
    /** A doc comment on a prop becomes its description in the props table. */
    isDisabled?: boolean;
    children?: unknown;
  }

  export type LinkProps<T extends AsTarget = 'a'> = AsProps<T, LinkOwnProps>;
</script>

<script generics="T extends AsTarget = 'a'">
  import { $props, type Bindable } from 'brumate/signals';

  const { as, href, isDisabled, children, ...rest } = $props<LinkProps<T>>();
  let { ref } = $props<{ ref?: Bindable<HTMLElement> }>();
</script>

<{as ?? 'a'} ref=$bind(ref) {href} {...rest}>{children}</>
```

- A part without `as` exports `<Name>Props` as one interface, and keeps `[attribute: string]: unknown` when it spreads attributes onto its element.
- `AsTarget`, `TargetProps` and `AsProps` are in packages/ui/src/as.ts.
- A part forwards `ref` with a `Bindable<HTMLElement>` prop and `ref=$bind(ref)` on its root (#243).

## Behavior

- With an element name in `as`, the props are the part's own props and the attributes of that element.
- With a component in `as`, the props are the part's own props and the props of the component. The component must forward `ref` for the part to get its element.
- A part's own props win over the target's.

## Stub

None needed: the types and Link, Button and Heading on main (after #245) are the reference.

## Contract tests

packages/ui/test/props-types.ts, checked by `pnpm --filter @brumate/ui typecheck`.

## Changes

- v1: from #242 (as #245) and #243.
