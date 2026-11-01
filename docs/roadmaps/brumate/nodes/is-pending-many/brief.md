---
id: is-pending-many
title: $isPending takes several memos
status: todo
priority: later
type: feature
story:
early: false
outline: true
milestone: backlog
target:
ship: auto
from:
size: S
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

# $isPending takes several memos

## Goal

`$isPending(a, b, c)` is true while any of the memos loads, so one guard covers code that reads several async memos at once. BRM182 then accepts a read of each memo the call names, as it does for `$isPending(a)` today. Waiting for several memos stays `await Promise.all([$resolve(a), $resolve(b)])`.

## Context

- Asked by the maintainer on 2026-11-01, while weighing the `toResult` question of browser-await-spike. A `$result` macro was dropped: `$resolve` returns a promise, so the JavaScript promise functions cover what Compostate's `waitForAll` and `toResult` do. This node is the one gap left: a guard for several memos without a chain of `||`.
- Today `$isPending(memo)` takes one memo (docs/decisions.md:28). Check whether `$isPending(a) || $isPending(b)` already counts as a guard for BRM182 before building, and record the rule in docs/decisions.md.
- Open for the refine: any or all (the proposal is any, since a read of each memo needs each to have a value).

Outline: not broken into a brief yet. Refine it when a release takes it.
