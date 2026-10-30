---
id: ui-gallery-from-groups
title: Regroup the ui sidebar and build the gallery from the groups
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
  - website/src/ui.ts
  - website/src/routes/ui/index.brm
  - website/src/components/Header.brm
  - website/plugins/markdown.ts
  - website/src/components/DocPage.brm
shared:
  - website/ui/*.md
reserves: []
provides: []
depends_on: []
---

# Regroup the ui sidebar and build the gallery from the groups

## Goal

Adding a part touches its own page and one line of `groups`, and the `/ui` gallery reads in the same order as the sidebar. Today `website/src/ui.ts` is 469 lines: `groups` (the sidebar) and `gallery` (about 330 lines of cards) in one file, in different orders, and five open nodes edit it.

## Context

- Found by the website audit of 2026-10-31 (findings 13, 18, 19, 20 of the ui audit).
- Move each card's summary into the front matter of its page (check whether `description` can serve), and generate the gallery by walking `groups`. Add group headings on `/ui`.
- Regroup, as proposed by the audit (a judgment call; confirm with the maintainer before building):
  - Actions: button, toggle-button, toggle-button-group, link, file-trigger, drop-zone.
  - Forms: text-field, search-field, token-field, number-field, slider, checkbox, checkbox-group, radio-group, switch, select, combo-box, autocomplete, form.
  - Pickers: colors, dates.
  - Overlays: add menu.
  - Navigation: add tabs, navigation-tree.
  - Collections: list-box, grid-list, tag-group, table, tree, virtualizer, data.
  - Utilities: add transition and selection-indicator (drops the one-page Animation group).
- Remove the unused `brm gallery` fence (`plugins/markdown.ts` ~65, 313-317; `DocPage.brm` 60-72; `'gallery'` in the part type).
- The header on ui pages has no link to `/` and no REPL link (`Header.brm` 28-46). Fix it here, since it is the same navigation work.

## Acceptance

- [ ] `ui.ts` holds only `groups`; the gallery is built from it and the pages' front matter.
- [ ] The gallery and the sidebar list the parts in the same order, under the same group headings.
- [ ] Every ui page is in exactly one group (a test fails otherwise).
- [ ] `pnpm --filter website check:samples && pnpm --filter website build` pass.
