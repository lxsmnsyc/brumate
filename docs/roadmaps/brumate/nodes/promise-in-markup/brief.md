---
id: promise-in-markup
title: A promise in markup renders its value, in text and in attributes
status: todo
priority: should
type: feature
outline: true
milestone: 0.5.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: promise-prop-memo
    kind: hard
    why: it makes a promise prop a plain promise, so markup then sees promises as ordinary values
  - on: browser-await-spike
    kind: hard
    why: the spike settles how the browser waits for a value; a promise in markup should wait the same way
---

# A promise in markup renders its value, in text and in attributes

## Goal

A promise is a native value in markup: `<p>{Promise.resolve('hello world')}</p>` renders `hello world` once the promise settles, and the nearest `#loading` shows its fallback while it is pending, on the server (streamed) and in the browser. A rejected promise goes to the nearest `#catch`. The same holds for a promise in an attribute value (the maintainer, 2026-10-30): `<p title={fetchTitle()} />` sets `title` once the promise settles. Decide what the attribute holds while pending (absent is the expected answer), how it streams on the server (the element is already sent when the value lands, so the browser sets it, or the boundary waits), and which attributes cannot wait (event handlers, `ref`, `$bind`, and others that must be there on first paint). Today a promise in markup is an error or prints `[object Promise]` (check which).

Prior art: React 19 accepts a promise (thenable) as a child and renders it with Suspense, as `use` does.

## Context

- Asked by the maintainer on 2026-10-30, after promise props became plain promises (promise-prop-memo, #373). Without this, `{user}` with a promise prop prints the promise object.
- Questions for the refine: the compiler cannot always see that an expression is a promise, so the runtime checks for a thenable on each text write; its cost in the client and on the rows benchmark; how it streams on the server (an implicit `#loading` boundary or the nearest one); a promise that changes before it settles (the later one wins); resume of a settled promise; whether `$memo` stays the way to share one promise between several reads.
- Check docs/decisions.md and proposals.md before proposing syntax.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
