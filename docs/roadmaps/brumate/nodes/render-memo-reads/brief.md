---
id: render-memo-reads
title: The browser render wraps only the memo reads that need it
status: todo
priority: should
type: refactor
outline: false
milestone: 0.8.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-06
owns: []
shared:
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: render-memos
    kind: hard
    why: it added the renderMemo wrapper and readMemo reads this node trims
---

# The browser render wraps only the memo reads that need it

## Goal

render-memos (#485) made the browser render run each memo once and hold a throw, as the docs promise (website/docs/effects.md: a memo that throws holds the error, each read throws to the nearest `#try`, an unread one keeps it silently). It costs examples/ui about +861 B gzip and todos about +57 B (clean rebuilds, 2026-11-06). The #485 review split it: about 360 B for the `renderMemo` wrapper of each memo, about 476 B for the 917 `readMemo` reads (282 in functions, 187 in memos, 161 in `provide`, 155 in attributes), about 26 B runtime.

Keep the behavior and cut the bytes. The review's option A: where a memo is read unconditionally at the top of the render body, the wrapper can throw at once, so those reads need no `readMemo`. Find the other read positions that cannot see a held error (reads in a memo that itself goes through `renderMemo` may already catch it), and measure each step. A sentinel or getter on the stored value does not work: render locals are plain `const`.

## Acceptance

- [ ] The memo-throw, debounce-start and function-prop-reads differential pages still match; the effects.md rules still hold (tests).
- [ ] examples/ui and examples/todos client gzip measured before and after on clean rebuilds; the cut is recorded per step.
