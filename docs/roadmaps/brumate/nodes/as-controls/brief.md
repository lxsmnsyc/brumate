---
id: as-controls
title: as and ref on the controls, overlays and status parts
status: todo
priority: should
type: feature
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify: pnpm --filter @brumate/ui exec vitest run test/as-controls.test.ts
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - packages/ui/src/ToggleButton.brm
  - packages/ui/src/Toolbar.brm
  - packages/ui/src/ToggleButtonGroup.brm
  - packages/ui/src/Disclosure.brm
  - packages/ui/src/DisclosureGroup.brm
  - packages/ui/src/DisclosurePanel.brm
  - packages/ui/src/RadioGroup.brm
  - packages/ui/src/CheckboxGroup.brm
  - packages/ui/src/Meter.brm
  - packages/ui/src/ProgressBar.brm
  - packages/ui/src/Toast.brm
  - packages/ui/src/ToastRegion.brm
  - packages/ui/src/Dialog.brm
  - packages/ui/src/Popover.brm
  - packages/ui/src/Tooltip.brm
  - packages/ui/test/as-controls.test.ts
  - packages/ui/test/fixtures/AsTarget.brm
shared:
  - packages/ui/test/props-types.ts
reserves: []
provides: []
depends_on:
  - on: props-types-main
    kind: hard
    why: as.ts and the exported props types are on main only after #245 merges
---

# as and ref on the controls, overlays and status parts

## Goal

Give these parts an `as` prop that takes an element name or a component, as Terracotta does, and forward `ref` to the element they render: ToggleButton, Toolbar, ToggleButtonGroup, Disclosure, DisclosureGroup, DisclosurePanel, RadioGroup, CheckboxGroup, Meter, ProgressBar, Toast, ToastRegion, Dialog, Popover and Tooltip.

## Context

- The part-props contract has the types (`AsProps`, `AsTarget`) and the pattern of ref forwarding (`ref=$bind(ref)` on a `Bindable<HTMLElement>` prop).
- A part that reads its root through `ref` now gets it through the forwarded binding, also when `as` names a component.
- Terracotta gives `as` to every component that renders an element.
- A part that binds its own root, such as Popover and Tooltip with `ref=$bind(panel)`, uses the `ref` prop as its root signal instead, as the part-props contract says. Do not put two `ref` bindings on one element.
- packages/ui/test/fixtures/AsTarget.brm is a component that forwards `ref`, for the tests of both as nodes. This node writes it.
- Out of scope: Checkbox, Radio, Switch, the Table parts, Modal, ModalOverlay, Sheet, MenuSection, ListBoxSection, and the Slider and Color parts. Their element is their meaning, or their code reads a fixed structure. Say so in the outcome if one turns out to be cheap.
- Source: Polymorphism, from the review of the parts against Terracotta (2026-10-26)

## Acceptance

- [ ] Each part renders `<{as ?? <default>}>` and takes the props of its target.
- [ ] A test for each part renders it with a component in `as`, and its keys, focus and ARIA still work.
- [ ] packages/ui/test/props-types.ts has a case for one of these parts.
- [ ] `pnpm --filter @brumate/ui exec vitest run` passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one pattern applied to 15 parts, with a test for each.
