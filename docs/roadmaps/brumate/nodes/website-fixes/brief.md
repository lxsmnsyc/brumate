---
id: website-fixes
title: Fix the home link, the shop demo, highlighting and the error section
status: todo
priority: should
type: fix
outline: false
milestone: ui-0.1
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/highlight.test.ts
exclusive: []
fulfilled_by: 
gate: false
added: 
owns:
  - website/src/components/Header.brm
  - website/src/components/BrandMark.brm
  - website/src/scripts.ts
  - website/src/routes/index.brm
  - website/src/routes/_layout.brm
  - packages/brumate/src/highlight.ts
  - packages/brumate/test/highlight.test.ts
shared:
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# Fix the home link, the shop demo, highlighting and the error section

## Goal

Fix four small faults of the website. The home link shows the brand mark. The bundle list of the shop demo shows only the shop bundles. `#reveal` and `#defer` are highlighted, from one list shared with the parser. The error section of the home page has no colored left border.

## Context

- BrandMark.brm is used in Header.brm, but the mark does not show. The favicon is logo.svg. The maintainer saw it on 2026-10-28 in both home links: "brumate" on the site and "brumate/ui" in the /ui header (the `.brand-section` link); each shows the text with no mark. Fix both.
- `NETWORK_SCRIPT` in website/src/scripts.ts keeps every script resource.
- `BLOCK_KEYWORDS` in packages/brumate/src/highlight.ts lacks `reveal` and `defer`, and lists `repeat`. The parser list is in packages/brumate/src/parser.ts.
- `.type-error` in website/src/routes/index.brm has `border-left: 3px solid #d1242f`.
- Source: [The home link](../../../../proposals.md#the-home-link)
- Source: [The shop demo on the home page](../../../../proposals.md#the-shop-demo-on-the-home-page)
- Source: [Syntax highlighting](../../../../proposals.md#syntax-highlighting)
- Source: [The error section on the home page](../../../../proposals.md#the-error-section-on-the-home-page)

## Acceptance

- [ ] A test fails when the highlighter and the parser list different block keywords.
- [ ] The header shows the mark in Chrome, on /, /docs and /ui, before "brumate" and before "brumate/ui", in light and dark.
- [ ] The shop demo lists only the bundles of the shop.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: four small fixes, each in its own file.
