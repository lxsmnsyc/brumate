---
id: promise-in-markup
title: A promise in markup renders its value, in text and in attributes
status: todo
priority: must
type: feature
story: browser-async
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

A promise is a native value in markup, in text and in attribute values: `<p>{Promise.resolve('hello world')}</p>` renders `hello world`, and `<p title={fetchTitle()} />` gets its `title`, once the promise settles. Prior art: React 19 renders a promise child with Suspense.

## Decisions (the maintainer, 2026-10-30)

One rule: a pending promise anywhere in markup, in text or in an attribute, makes its nearest `#loading` boundary pending, as a loading memo does today.

1. Text: inside a `#loading`, the boundary shows its `#else` fallback until the promise settles; the server streams the content when it settles.
2. Attributes: the same rule. The boundary is pending until the attribute's promise settles, and the element is sent with its final attributes. No path that sets an attribute after the element was sent.
3. No boundary: the server waits for the promise before it sends that part, as for an awaited memo outside a boundary.
4. Where a promise cannot wait (event handlers, `ref`, `$bind`, binding shorthands, the `by` key of `#for`): a compile error when the compiler sees the promise type (a new BRMnnn, reserve it at refine), and a dev-mode runtime error otherwise. Production uses the value as it is.
5. Resume: the settled value goes into the page state; the browser does not call the expression again on resume. It re-runs the expression only when a signal it reads changes.

Defaults (not asked, change at refine if they prove wrong):

- A promise replaced before it settles: the latest wins and the older result is dropped.
- A rejected promise goes to the nearest `#catch`; with none, the page error, as today.
- On an update, a new pending promise keeps the boundary's current content until it settles, as `#loading` does on an update.
- A promise in a spread (`{...attrs}`) follows the attribute rule. Boolean attributes resolve to true or false; a promise for `null` or `undefined` removes the attribute.

## Context

- Asked by the maintainer on 2026-10-30, after promise props became plain promises (promise-prop-memo, #373). Without this, `{user}` with a promise prop prints the promise object.
- Open for the refine: how the compiler and runtime tell a promise apart (a thenable check on each text and attribute write) and its cost in the client and on the rows benchmark; whether `$memo` stays the way to share one promise between several reads; the interplay with browser-await-spike.
- Check docs/decisions.md and proposals.md before proposing syntax; record the decisions above in docs/decisions.md when the node is built.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
