---
id: docs-sidebar-structure
title: Order the docs sidebar by the reader's path and split testing.md
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
  - website/src/docs.ts
  - website/docs/testing-server.md
shared:
  - website/docs/testing.md
  - website/docs/security.md
  - website/docs/reference-security.md
reserves: []
provides: []
depends_on: []
---

# Order the docs sidebar by the reader's path and split testing.md

## Goal

The docs sidebar follows the order a reader needs the pages in, and `testing.md`, which four open nodes edit, is split by feature so they stop meeting in one file.

## Context

- Found by the website audit of 2026-10-31 (structure section of the core docs audit).
- Move Testing from Production to Tools (next to typescript, editor and inspect). Move `what-runs-where` right after Components. Consider putting Pages before Data, since forms and async data assume routes.
- `security.md` and `reference-security.md` cover one topic in two groups. Merge them, or keep both with a two-way link (their titles and labels were made to agree before 0.4.0).
- Split `testing.md` (200 lines) into `testing.md` (setup, mount, triggers) and `testing-server.md` (server functions, routes, about 90 lines). Do not split `styles.md`: its sections are about 25 lines each.
- Optional, only if they still read long: `server-functions.md` (522 lines) into server functions and caching/sessions; `async-data.md` (420) and `forms.md` (416).
- Open nodes that edit `testing.md`: a11y-in-tests, conditional-rest-spread, drop-colon-modifiers, memo-guard. Land this before them, or tell their workers where the sections moved.

## Acceptance

- [ ] The sidebar order in `docs.ts` follows the path above; every old URL still resolves (a redirect or the same slug).
- [ ] `testing.md` and `testing-server.md` exist, with links between them, and every internal link resolves.
- [ ] `pnpm --filter website check:samples && pnpm --filter website build` pass.
