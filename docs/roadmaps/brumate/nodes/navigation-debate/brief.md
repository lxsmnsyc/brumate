---
id: navigation-debate
title: "Debate: partial responses, a component router, or the full-page swap"
status: todo
priority: must
type: docs
story: partial-route-responses
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-18
spent:
owns:
  - docs/debates/navigation/**
  - docs/roadmaps/brumate/nodes/navigation-debate/**
shared: []
reserves: []
provides: []
depends_on:
  - on: partial-measure
    kind: hard
    why: the debate weighs the measured cost of today's full-page swap
---

> 2026-11-18: added by the maintainer, who asked whether navigation should move to a component-based router (as Solid Router or React Router) instead. The orchestrator runs it with the goal-debate skill once partial-measure has its baseline, before partial-render-spike starts.

# Debate: partial responses, a component router, or the full-page swap

## Goal

Decide, with evidence, which navigation model brumate builds next:

1. Partial route responses (this story): the client sends the layouts it keeps, the server renders only the new routes.
2. A component-based client router, as Solid Router, React Router or Qwik City do: routes render in the browser.
3. Keep today's full-page swap (`planRoutes`, `replaceRoutes` in `runtime/navigate.ts`) and spend the story's budget elsewhere.

## Context

- The maintainer chose 1 over 2 on 2026-10-30. Reasons in the story brief: 2 ships every page component to the browser, needs server-only components and `await` in components to run in the browser, and adds a render path beside resume. Since then browser-await is done, so `await $memo` already runs in a browser render. server-components-spike (0.9.0) may change the picture for server-only components.
- Prior art to read from source, pinned by URL and SHA: Solid Router, React Router (with and without RSC), Qwik City, Next.js app router, Marko Run, Turbo.
- Inputs: the baseline of partial-measure (bytes and swap time between two docs pages that share layouts), the size of `navigate.ts`, and the client size of today's pages.

## Acceptance

- [ ] `docs/debates/navigation/debate.md` with the settled choice, the rejected options with reasons, and the gate threshold for partial-render-spike (default: the partial response is at least 40% smaller in gzip than the full page for the measured pairs).
- [ ] The maintainer approves the debate. On option 2 or 3, the orchestrator rewrites or drops the story's remaining children and amends the 0.9.0 cut.

## Sizing

S: one debate with a measured input.
