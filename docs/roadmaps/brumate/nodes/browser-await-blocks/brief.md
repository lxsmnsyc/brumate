---
id: browser-await-blocks
title: "await in block scripts, #for rows and markup, with topological starts"
status: todo
priority: must
type: feature
story: browser-async
early: false
outline: false
milestone: 0.5.0
target:
ship: auto
from:
size: M
spike: false
hypothesis:
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-01
spent:
owns:
  - packages/brumate/src/codegen/**
  - packages/brumate/test/resume.test.ts
shared:
  - packages/brumate/src/runtime/client/**
reserves: []
provides: []
depends_on:
  - on: browser-await
    kind: hard
    why: it extends the split and the runtime wait of browser-await to more places
---

# await in block scripts, #for rows and markup, with topological starts

## Goal

The split of browser-await also covers `await $memo` in a `<script>` of a block body and of a `#for` row, and `await` in markup (`{(await user).name}`, moved to the start of the markup as the server does in `emitLoading`). Awaited memos start their loads as early as their inputs allow.

## Context

- Topological starts (the maintainer, 2026-11-01): each awaited memo's load starts right after the last plain statement it reads: `$$w_x = load()` for a memo that reads no other awaited memo, `$$b.after([...], fn)` for one that does. Each `await` still waits where it is written, code between awaits runs once and in order, and `waitAll` stays as is. About +40 B gzip over `wait`. A parent-to-child chain through a plain value stays a chain.
- The analysis of which names each memo reads is shared with topological-awaits-server; keep it in one function both use.
- See [browser-await-spike outcome](../browser-await-spike/outcome.md), "Topological awaits".

## Acceptance

- [ ] `await $memo` waits in a block script, a `#for` row script and in markup of a browser render, with tests.
- [ ] Two independent awaits separated by a plain statement start their loads together (a test counts the overlap); a dependent one starts when its input settles.
- [ ] Todos gzip: 0 B change.

## Sizing

M: compiler work on three more places and the start analysis.
