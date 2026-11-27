---
id: defer-visible-request
title: "Diagnose: a visible #defer body shows without a body request"
status: todo
priority: should
type: diagnose
story:
early: false
outline: false
milestone: 0.10.0
target:
ship: auto
land: auto
from:
size: S
risk: low
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-26
spent:
owns:
  - docs/roadmaps/brumate/nodes/defer-visible-request/**
shared: []
reserves: []
provides: []
depends_on:
  - on: client-scripts
    kind: hard
    why: seen on the story branch, with tracker on Nitro
---

# Diagnose: a visible #defer body shows without a body request

## Goal

Found by nitro-prerender (2026-11-26) on `feat/client-scripts`, with tracker running on Nitro. A live page with `#defer ('visible')` showed its body (a signed-in line) in the browser with no `x-brumate-defer` request and no `defer-*.js` chunk. curl with a valid session cookie got only the fallback. It was the same with the body as inline markup, with a server-only value, and as a pure markup component. Either the body reaches the page another way (a bug that would also skip the stylesheet wait), or the test setup misleads. Find which, with the root-cause skill.

## Context

- Start on the story branch: a page `/later` in tracker with `#defer ('visible') { <p class="later">{user.name}</p> } #else { … }` and a stylesheet in the body. Playwright with request logging, as the tracker e2e suite runs it.
- Then check the same page on `main` with tracker's old Node server, to tell whether Nitro or the story changes it.
- The e2e step "#defer body waits for its stylesheet" was dropped in examples-glue and could not come back in nitro-prerender because of this.

## Acceptance

- [ ] The outcome has a diagnosis: the cause at file and line, a failing test or repro, and where the fix goes (a fix node, or a test-setup note).

## Sizing

S: a diagnose node; the fix is a separate node.
