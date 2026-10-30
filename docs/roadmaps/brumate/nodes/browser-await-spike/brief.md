---
id: browser-await-spike
title: "Spike: await in a component that the browser renders waits, like React's use"
status: todo
priority: should
type: spike
outline: false
milestone: 0.5.0
target:
from:
size: M
spike: true
verify:
exclusive: [bench]
fulfilled_by:
gate: true
added: 2026-10-30
owns:
  - docs/roadmaps/brumate/nodes/browser-await-spike/**
shared: []
reserves: []
provides: []
depends_on:
  - on: streamed-memo-reads
    kind: hard
    why: it adds BRM182, which exempts awaited memos, and the runtime error for handler reads of loading memos; the spike builds on both
---

# Spike: await in a component that the browser renders waits, like React's use

## Goal

`const user = await $memo(fetchUser(id))` waits on the server, but in a component that the browser renders for the first time (a branch of an `#if` that turns true, a row added to a `#for`), the browser render is synchronous and compiles it to `const user = (fetchUser(id))`. The script after it, its handlers and its markup then see a promise. docs/decisions.md:27 says "In the browser the value is settled, so both are plain reads", which holds only for components that the server rendered.

The maintainer wants `await` to wait in the browser too, as React's `use` does: the component stops at the `await` until the memo settles, the nearest `#loading` shows its `#else` body (or keeps its content on an update), and the render goes on with the value. Then the BRM182 exemption for awaited memos holds everywhere, and "await it in the script" is a fix in the browser too.

## Options to compare

1. Throw and run again from the top (React). The script runs again, so signals, effects and `$client` declared before the `await` would be created twice unless state is kept across runs.
2. An async render function. Every browser render becomes a promise: size, microtask hops, and the order of `pass` and the effect flush.
3. Split the render at each `await $memo` into continuations that the compiler emits (Marko cuts at awaits too). Code before and after the `await` runs once; components without `await` do not change.

Also check whether Compostate's `toResult` helps (github.com/lxsmnsyc/compostate, `packages/compostate/src/extra/concurrency.ts`, docs in `website/src/content/docs/concurrency.md`). `toResult(signal)` reads a signal without throwing and returns `{ type: 'pending', request }`, `{ type: 'success', value }` or `{ type: 'failure', value }`, where `request` is the promise in flight. Questions: can the render of a continuation (option 3) or a rerun (option 1) use such a read to decide between going on and waiting on `request`, and is a `toResult`-like macro worth exposing as a third way, beside `await` and `$isPending`, for a handler to read a memo that BRM182 accepts?

For each: the change to codegen and the client runtime, the cost in gzip JS before `load` (`pnpm bench`, exclusive), what `await` inside a block or a `#for` row means, how `#loading`, `#reveal` and `#try` see the wait, and how the page state and IDs stay in step with the server for components that the server rendered.

## Context

- Decided on 2026-10-30, while reviewing PR #352 (streamed-memo-reads): browser await lands in 0.5.0, and a spike chooses the approach first.
- Until it lands, a handler that reads an awaited memo in a browser-rendered component gets the runtime error that streamed-memo-reads adds.

## Acceptance

- [ ] outcome.md compares the three options with a prototype or a measured estimate for each, recommends one, and lists the nodes to build it (gate: the maintainer chooses).
