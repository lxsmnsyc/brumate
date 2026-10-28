---
id: ref-type-parts
title: The forwarded ref of the collection parts, Link, Button and Heading takes an optional element
status: done
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify: pnpm --filter @brumate/ui typecheck
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/ui/src/ListBox.brm
  - packages/ui/src/ListBoxItem.brm
  - packages/ui/src/Menu.brm
  - packages/ui/src/MenuItem.brm
  - packages/ui/src/GridList.brm
  - packages/ui/src/GridListItem.brm
  - packages/ui/src/Tree.brm
  - packages/ui/src/TreeItem.brm
  - packages/ui/src/TabList.brm
  - packages/ui/src/Tab.brm
  - packages/ui/src/TabPanel.brm
  - packages/ui/src/TagList.brm
  - packages/ui/src/Tag.brm
  - packages/ui/src/Link.brm
  - packages/ui/src/Button.brm
  - packages/ui/src/Heading.brm
shared:
  - .changeset/*.md
  - packages/ui/test/props-types.ts
reserves: []
provides: []
depends_on:
  - on: as-collections
    kind: hard
    why: it edits the parts that as-collections rewrote
---

# The forwarded ref of the collection parts, Link, Button and Heading takes an optional element

## Goal

These parts declare `ref?: Bindable<HTMLElement | undefined>` in their own props, as part-props v1.3 says, so `ref=$bind(signal)` with a caller's `$signal<HTMLElement>()` type checks. Today they declare `Bindable<HTMLElement>` in a separate `$props` line, which rejects that signal.

## Context

- The contract: [contracts/part-props.md](../../contracts/part-props.md), v1.3, and its change request part-props-ref.change-request.md.
- as-controls (#273) already uses the v1.3 form in its 15 parts. Copy it.
- Add a case to packages/ui/test/props-types.ts, at the end in one block: `ref=$bind(signal)` with `$signal<HTMLElement>()` on one collection part, and on Link.

## Acceptance

- [ ] Each listed part declares `ref` in `<Name>OwnProps` (or `<Name>Props` for a part with no `as`) as `Bindable<HTMLElement | undefined>`.
- [ ] The new props-types.ts case passes, and fails with the old type.
- [ ] `pnpm --filter @brumate/ui exec vitest run` and `pnpm --filter @brumate/ui typecheck` pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one type on 16 parts.
