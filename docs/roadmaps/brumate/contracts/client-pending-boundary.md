---
name: client-pending-boundary
version: 1
status: draft
defined_by: browser-await
---

# Contract: client-pending-boundary

## Purpose

The runtime interface between a render that waits (`wait` from browser-await) and the boundary that holds it: the root boundary, `#loading` in a browser render (browser-loading-fallback), a promise in markup (promise-in-markup) and `#try` (browser-try).

## Interface

Written by browser-await when it freezes the contract, from the spike's prototype (`$$b.wait(scope, value, rest)`, `$$b.loading(body, fallback)`, `hold` at the insert sites).

## Behavior

- A boundary counts the waits of the renders inside it and runs `done` when the count reaches 0.
- A boundary keeps the `rendered` and `afterInsert` work of its body until the body enters the page.
- On an update, a boundary keeps its current content until the new waits settle. Outside every `#loading`, the root boundary does the same.
- A rejected wait calls `fail(scope, error)`, which renders the nearest `#catch`.

## Stub

None yet.

## Contract tests

In packages/brumate/test/resume.test.ts, added by browser-await.

## Changes

- v1: initial draft from browser-await-spike (2026-11-01).
