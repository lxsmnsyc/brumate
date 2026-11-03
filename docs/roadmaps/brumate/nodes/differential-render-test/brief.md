---
id: differential-render-test
title: "Render every test page in the server and in the browser and compare"
status: active
priority: must
type: chore
outline: false
milestone: 0.6.0
target:
from:
size: M
spike: false
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-02
spent:
owns: []
shared:
  - packages/brumate/test/**
reserves: []
provides: []
depends_on:
  - on: browser-async
    kind: hard
    why: after the 0.5.0 must line (client-restructure debate, step 3)
---

# Render every test page in the server and in the browser and compare

## Goal

A test that renders each page of packages/brumate/test/render two ways, server render plus resume and browser render after a toggle, and compares the DOM, the slot values and where errors go. Each divergence is listed as a special case to remove or an accepted difference.

## Context

- Step 3 of the client-restructure debate (docs/debates/client-restructure/debate.md, P6, O6). Its divergence count is the simplicity gate of values-spike (O15).
- Prior art: Marko's runtime-tags fixtures run 1543 fixtures both ways, with per-fixture configs and about 75 opt-outs (O6).
- The 478 test/render files are not standalone roots and have no snapshots; 74 use server-only features (O6). Opt them out with a reason.

## Acceptance

- [ ] The test runs in `pnpm --filter brumate test`.
- [ ] A list of divergences, each marked accepted (with reason) or a case to remove, with the count in outcome.md.

## Sizing

M: about 0.4M tokens (O6).
