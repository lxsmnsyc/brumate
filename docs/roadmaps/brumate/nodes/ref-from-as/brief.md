---
id: ref-from-as
title: The ref of a part takes the element type of its as target
status: active
priority: should
type: feature
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify: pnpm --filter @brumate/ui typecheck
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/ui/src/as.ts
shared:
  - .changeset/*.md
  - packages/ui/test/props-types.ts
  - docs/roadmaps/brumate/contracts/part-props.md
  - packages/ui/src/Button.brm
packages/ui/src/CheckboxGroup.brm
packages/ui/src/Dialog.brm
packages/ui/src/DisclosurePanel.brm
packages/ui/src/GridListItem.brm
packages/ui/src/Link.brm
packages/ui/src/Disclosure.brm
packages/ui/src/Menu.brm
packages/ui/src/DisclosureGroup.brm
packages/ui/src/Meter.brm
packages/ui/src/GridList.brm
packages/ui/src/ListBoxItem.brm
packages/ui/src/Heading.brm
packages/ui/src/ListBox.brm
packages/ui/src/MenuItem.brm
packages/ui/src/Popover.brm
packages/ui/src/ProgressBar.brm
packages/ui/src/RadioGroup.brm
packages/ui/src/Tag.brm
packages/ui/src/Tab.brm
packages/ui/src/TabList.brm
packages/ui/src/TabPanel.brm
packages/ui/src/TagList.brm
packages/ui/src/ToggleButton.brm
packages/ui/src/ToastRegion.brm
packages/ui/src/Tooltip.brm
packages/ui/src/Toast.brm
packages/ui/src/ToggleButtonGroup.brm
packages/ui/src/Tree.brm
packages/ui/src/TreeItem.brm
packages/ui/src/Toolbar.brm
reserves: []
provides: []
depends_on:
  - on: ref-reaches-element
    kind: hard
    why: it rewrites the ref of Link, Button and Heading
---

# The ref of a part takes the element type of its as target

## Goal

`<Button as="a" ref=$bind(link)>` types `link` as `HTMLAnchorElement | undefined`, and `<Button ref=$bind(b)>` as `HTMLButtonElement | undefined`, as Terracotta infers the element from `as`. Today every part types `ref` as `Bindable<HTMLElement | undefined>`, which accepts a signal of the wrong element and loses the element type.

## Context

- Request of the maintainer, 2026-10-27: the `HTMLElement` ref is inaccurate. Terracotta infers the element type from the `as` prop.
- Add a type to packages/ui/src/as.ts, for example `TargetElement<T>`: `ElementOf<T>` of `brumate/elements` for an element name, the element of the component's own `ref` prop (`Bindable<infer E>`) for a component, and `Element` when the component has no typed `ref`.
- Each part declares `ref?: Bindable<TargetElement<T> | undefined>` in its props. `T` is the part's `as` type parameter with its default element, so a part with no `as` gets its default element.
- Check that a generic part body still compiles: inside the part, `T` is generic, and code that reads the element (focus, `contains`) needs it as an `HTMLElement` or `Element`. Prefer a local `const el = ref as HTMLElement | undefined` in the body over loosening the prop type, or constrain where the part needs it.
- This changes the part-props contract (v1.3 says `Bindable<HTMLElement | undefined>`). The maintainer asked for it; write it as v1.4 in the contract with a change entry.
- The core check (#277, bound-element-signal) lets a `ref`-only signal hold any `Element`, so element subtypes pass it.

## Acceptance

- [ ] props-types.ts has cases: a button signal on a Button passes; an anchor signal on `<Button as="a">` passes; a button signal on `<Button as="a">` is an error; a component target with a typed `ref` gives its element. The error case is valid on main.
- [ ] Every part with a forwarded ref uses the inferred type, and part-props is v1.4.
- [ ] `pnpm --filter @brumate/ui exec vitest run` and `pnpm --filter @brumate/ui typecheck` pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one type, then the same line in about 30 parts, and the generic bodies that read the element.
