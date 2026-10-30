---
id: ui-page-sections
title: One section order and one set of headings for the ui pages
status: todo
priority: should
type: docs
outline: false
milestone: 0.5.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-31
owns:
  - website/test/ui-sections.test.ts
shared:
  - website/ui/*.md
reserves: []
provides: []
depends_on:
  - on: ui-gallery-from-groups
    kind: hard
    why: both edit the ui pages; the front matter summaries land first
---

# One section order and one set of headings for the ui pages

## Goal

Every ui page follows the section order of the props-table contract (`plugins/props-table.ts` SECTIONS: Anatomy, Props, Data attributes, Keyboard, Controlled and uncontrolled, Styling), names the same idea with the same heading, and a test keeps it that way.

## Context

- Found by the website audit of 2026-10-31 (findings 5 to 12 and 14 of the ui audit).
- Out of order: transition, virtualizer, preview-trigger; Use cases before Props in heading, keyboard, selection-indicator, visually-hidden, i18n-provider.
- Topic sections (Segments, Cells, Hex, Channel) sit before Use cases on some pages and after on others. Pick one.
- Keyboard content is under "Keyboard", "Focus and keys", "Keys and screen readers" or "Drag from the keys"; "Rows from data", "Items from data", "Rows", "Items"; "Style" vs "Styling". Decide whether pages get an "Accessibility" heading.
- Missing sections to check: Data attributes (dialog, file-trigger, form, color-picker, color-swatch, data, i18n-provider, keyboard), Anatomy pictures (color-picker, data, file-trigger, selection-indicator, transition), styled examples (heading, i18n-provider, keyboard, visually-hidden, data, selection-indicator). Add only where the part has something to show.
- `.brm` samples use ` ```html ` on most pages and ` ```brm ` on some, in both `website/ui` and `website/docs`. Pick one (check what the highlighter does).
- The ui introduction has no install line and no note that `brumate` is a peer dependency.
- `ModalContent` exports a props type with no props table; decide whether it is public.

## Acceptance

- [ ] A vitest in `website/test` reads each ui page and fails when its h2 headings break the order, with an allowlist for the concept pages (introduction, styling, state, resuming, layers, influences).
- [ ] One heading per idea across the ui pages, and one fence language for `.brm` samples on the site.
- [ ] `pnpm --filter website check:samples && pnpm --filter website test` pass.
