---
id: state-dedupe-spike
title: "Spike: leave out state strings the markup already printed"
status: todo
priority: should
type: experiment
story:
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: M
spike: true
hypothesis: docs/debates/navigation/debate.md
verify:
exclusive: [bench]
fulfilled_by:
gate: true
added: 2026-11-18
spent:
owns:
  - docs/roadmaps/brumate/nodes/state-dedupe-spike/**
shared: []
reserves: []
provides: []
depends_on:
  - on: partial-measure
    kind: hard
    why: it uses benchmarks/navigation for the throttled run and the byte numbers
---

> 2026-11-18: from the navigation debate (docs/debates/navigation/debate.md, settled structure 4 and 5), approved by the maintainer.

# Spike: leave out state strings the markup already printed

## Goal

The state record of a page repeats long strings that the page's own markup already printed: 58.7 KB raw of the 72 KB state on `/docs/context`, 106.5 KB of the ui state on `/ui/dialog` (debate O11). Find out whether the server can leave such a string out of the state record safely, and what that saves. Also run the throttled navigation measurement the debate asked for.

## Steps

1. Throttled measurement (debate P13, O7): run `node benchmarks/navigation/run.mjs` with Chrome's Fast 4G and Slow 4G profiles and a 4x CPU slowdown, on today's full page. Record median and p90 swap time and load average. This number is the restart condition of the parked partial-route-responses story.
2. Safety first (debate O12): a value left out of the state must never be read again by a render in the browser. Find every way a block can render again from a value: a changed prop, `#key`, a `#loading` reload, a refresh, a store or context change, client navigation that keeps a region. The docs route renders `<DocPage slug=(params.page) />`, and DocPage reads `pages[slug]` from a module; check whether a prop change there can only come from a navigation that replaces the region (`plan`, `runtime/navigate.ts:123`). Decide the rule on the server (which values it may leave out) from that analysis, with tests that prove each case renders the same HTML as an unblanked page.
3. Prototype on a local branch, measure the full response bytes (gzip and brotli) for the measured pairs, and the first load of the same pages. Repeat step 1 on the prototype.

## Gates (fixed before the run)

- Go needs all of: (1) the tests of step 2 cover every way listed and all render the same HTML as an unblanked page; (2) the full navigation response of `/docs/context` and `/ui/dialog` is at least 15% smaller in gzip than on `release/0.9`; (3) the brumate test suite passes on the prototype.
- Anything else is a no-go: the state record stays as it is.

## Acceptance

- [ ] outcome.md has the throttled numbers, the safety analysis with its tests, the byte numbers with commands and commits, the gate results, a design for one build node (size and files), and a go or no-go.
- [ ] The prototype lives on a local branch named in the outcome.

## Sizing

M: time-boxed, about 0.4M tokens.
