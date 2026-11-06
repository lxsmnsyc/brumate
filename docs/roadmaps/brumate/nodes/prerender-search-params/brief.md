---
id: prerender-search-params
title: A prerendered page keeps its query string, and $searchParam reads it on load
status: active
priority: must
type: fix
outline: false
milestone: 0.6.1
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-06
owns: []
shared:
  - packages/brumate/src/runtime/client/search.ts
  - packages/brumate/test/**
  - e2e/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# A prerendered page keeps its query string, and $searchParam reads it on load

## Goal

Issue #466. On a prerendered page opened at `/?c=ulam`, `$searchParam('c')` keeps the build's `null`, the page shows `all`, and the loader rewrites the URL to `/`. The page state was rendered without a query string. `paramEffect` (packages/brumate/src/runtime/client/search.ts, about line 45) compares the signal with `location.search`, finds them different, and queues a `commit` that writes the signal to the URL. Its comment says the URL never changes on load, which a prerendered page breaks.

Fix: on load, the URL is the source. When the signal differs from `location.search`, write the signal from the URL (the readers update once the code loads) and leave the URL as written. Do it for every page: a server-rendered page already matches, so nothing changes there. A parameter with `server: true` keeps its navigation rule.

## Acceptance

- [ ] A test: a page rendered without a query string resumes at `/?c=ulam`; the signal reads `ulam`, readers show it, and `location.search` stays `?c=ulam` with no history entry added.
- [ ] A server-rendered page with a query string still writes nothing on load (existing tests).
- [ ] A prerendered e2e page, or a test of the prerender build, served statically with a query string.
- [ ] Changeset (patch); close #466 from the PR.
