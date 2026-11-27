---
id: defer-stylesheets
title: "#defer bodies keep their stylesheets, and e2e sees streaming"
status: active
priority: should
type: fix
story:
early: false
outline: false
milestone: 0.10.0
target:
ship: auto
land: auto
from:
size: M
risk: medium
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-27
spent:
owns:
  - e2e/run.mjs
  - e2e/suites/tracker.mjs
  - docs/roadmaps/brumate/nodes/defer-stylesheets/**
shared:
  - packages/brumate/src/runtime/navigate.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/**
  - e2e/suites/**
  - examples/tracker/src/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: defer-visible-request
    kind: hard
    why: builds the fix its diagnosis chose
---

# #defer bodies keep their stylesheets, and e2e sees streaming

## Goal

defer-visible-request (2026-11-27) found that the e2e browser is a crawler to the server: `BOTS` in `runtime/server.ts` lists `headlesschrome`, `e2e/run.mjs` sets no user agent, so with the default `inOrder: 'bots'` every e2e page renders `#loading` and `#defer` in place. No e2e step tests streaming or the `#defer` request. Behind that, two real bugs: (B) after a client link navigation, `pruneSheets` (`runtime/navigate.ts`) removes the route's CSS link while only the fallback shows, so a `<style>` in the `#defer` body arrives unstyled; (C) on a prerendered shell page, `fillHoles` sends `load` and `idle` bodies in the same response and its swap script shows them without waiting for their stylesheet links, which `website/docs/styles.md` promises.

## Context

- Read `nodes/defer-visible-request/outcome.md`; the repro is in its `repro/` folder (tracker pages `later.brm`, `later2.brm`, `LaterBox.brm`, scripts `probe.mjs` and `shell-sheet.mjs`). The outcome lists fix options with cost and risk.
- Setup first: give every e2e browser context a user agent without "Headless", and add one e2e step that a crawler agent still gets the body in place. Run the whole e2e suite after that change. Each streaming step that then fails is a bug: fix it here if it is small, otherwise list it in the outcome as a finding for a new node. Keep `headlesschrome` on the crawler list.
- B: the `#defer` answer links the CSS file that holds the body's `<style>` rules (or keep that link through `pruneSheets`); pick the option the outcome ranks best.
- C: the swap script waits for the body's stylesheet links, as `defer.ts` does, with the same timeout. `#loading` bodies are out of scope: the docs promise the wait only for `#defer` and navigation.
- Restore the e2e step "#defer body waits for its stylesheet" dropped in examples-glue.

## Acceptance

- [ ] The repro scripts go green for the symptom, B and C; each bug has a test that fails on the base.
- [ ] e2e runs with a non-crawler agent, plus one crawler step; `node e2e/run.mjs` passes.
- [ ] The "#defer body waits for its stylesheet" step is back and passes.
- [ ] A patch changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: the e2e agent, two runtime fixes with tests, and the streaming steps the agent change exposes.
