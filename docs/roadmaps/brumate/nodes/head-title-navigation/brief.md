---
id: head-title-navigation
title: A title in #head follows its memo after client navigation
status: todo
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
  - packages/brumate/src/runtime/client/titles.ts
  - packages/brumate/src/runtime/client/page.ts
  - packages/brumate/src/runtime/client/insert.ts
  - packages/brumate/test/**
  - e2e/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# A title in #head follows its memo after client navigation

## Goal

Issue #467. A route with `#head { <title>{title}</title> }`, where `title` is a memo, updates `document.title` after a full load, but not after the client router loads the page (open `/`, go to `/other`, come back with a link, change the signal: the title stays). The rest of the page updates. The reporter reduced the steps from an app (route under a root layout that stays) and did not run the reduced version; reproduce first.

Where to look: titles.ts keeps `document.title` in step with `title[b-t]` elements through one `MutationObserver` (`watchTitles`, started from resume.ts and insert.ts), and page.ts inserts `#head` markup with `insertHTML` into `document.head`. Check whether the navigated page's `<title>` text is bound at all, whether the old `<title>` stays and wins as the last one in `syncTitle`, and whether the observer still runs after navigation.

## Acceptance

- [ ] A test (vitest with the router, or e2e) of the issue's steps: the title follows the memo after navigating away and back; it fails on main.
- [ ] Full-load behavior unchanged (existing title tests).
- [ ] Changeset (patch); close #467 from the PR.
