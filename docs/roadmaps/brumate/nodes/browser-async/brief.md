---
id: browser-async
title: Async values wait in markup that the browser renders
status: todo
priority: must
type: story
story:
early: false
outline: false
milestone: 0.5.0
target:
ship: auto
from:
size: L
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-01
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on: []
---

# Async values wait in markup that the browser renders

## Goal

A component that the browser renders for the first time (a branch of an `#if` that turns true, a `#for` row added later, a component inside them) treats async values as a server-rendered one does. `await $memo(...)` waits, `#loading` shows its `#else` fallback while its memos are pending, a promise in text or an attribute renders its value, and `#loading (memo)` shows the fallback again when a named memo loads again.

## Children

On the branch `feat/browser-async`, cut from `next`:

1. browser-await-spike: compares three ways to wait and recommends one. Gate: the maintainer picks the approach before any other child is refined.
2. browser-loading-fallback, promise-in-markup and loading-on: outlines until the spike's choice is made. Refine them from its outcome, so all three use one client-side pending boundary.

## Context

- The maintainer made this a must story of 0.5.0 on 2026-11-01, with one pull request to `next` for the whole feature.
- loading-on also waits on the approval of docs/debates/loading-on-update/debate.md (status: proposed).
- website/docs/async-data.md and docs/decisions.md:27 say that `await` does not wait in the browser. The story updates both.

## Acceptance

- [ ] Every child is done on `feat/browser-async`.
- [ ] The e2e suite covers an `#if` branch and a `#for` row that the browser renders, each with an awaited memo, a `#loading` fallback and a promise in text.
- [ ] `pnpm bench` todos gzip JS before `load` stays within 0.3 kB of `next`. A page that uses none of these features pays for none of them.
- [ ] One pull request from `feat/browser-async` to `next`, reviewed by the maintainer.

## Sizing

L in total, across one M spike and three children.
