---
id: ui-gallery-from-groups
title: The ui cards read their summaries from the pages
status: todo
priority: should
type: docs
outline: false
milestone: 0.5.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-31
owns:
  - website/src/ui.ts
  - website/src/ui-landing.ts
  - website/plugins/markdown.ts
  - website/src/components/DocPage.brm
  - website/src/routes/ui/_layout.brm
  - website/test/**
shared:
  - website/ui/*.md
reserves: []
provides: []
depends_on: []
---

# The ui cards read their summaries from the pages

## Goal

Adding a part touches its own page and one line of `groups` in `website/src/ui.ts`. Today `ui.ts` also holds `gallery`, about 330 lines with a summary for each of the 64 parts, kept apart from the pages, and six open nodes edit the file.

## Context

- Re-evaluated on 2026-11-01, after the website redesign (#399, 6262541e). The redesign already lists the cards on `/ui` in the order and under the group headings of the sidebar: `kinds` in `src/ui-landing.ts` walks `sections`, and `routes/ui/index.brm` renders it. The maintainer confirmed: the groups stay as they are while the landing page and the sidebar match, and the ui header gets no REPL link.
- Move each card's summary into the front matter of its page (check whether `description` can serve, since the search index and the meta tags may already read it), and build the cards from `sections` and the front matter. `gallery` and the lookup loop in `ui-landing.ts` go.
- Remove the `brm gallery` fence that no page uses any more: `plugins/markdown.ts` (the `{ gallery: true }` part, about line 65 and 328-332), its branch in `DocPage.brm` (about 125-131), and `:global(.ui-gallery)` in `routes/ui/_layout.brm`.

## Acceptance

- [ ] `ui.ts` holds only `groups` (and the page and demo tables); the summaries live in the pages' front matter.
- [ ] `/ui` shows the same cards, summaries and order as before.
- [ ] A test fails when a ui page is in no group or in two, or when a part's page has no summary.
- [ ] `pnpm --filter website check:samples && pnpm --filter website build` pass.

## Sizing

S: a data move across the part pages, one deleted fence and one test.
