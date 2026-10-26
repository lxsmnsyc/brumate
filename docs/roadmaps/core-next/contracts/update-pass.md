---
name: update-pass
version: 1
status: draft
defined_by: batching
---

# Contract: update-pass

## Purpose

What a pass of updates is, so code that writes several values, such as `$searchParam`, can make one change at the end of it.

## Interface

To be frozen by batching, as its first step, before search-params starts. It must define these signatures:

- When a pass starts and ends: a handler up to its first await, a `$client` callback, a run of effects, a value that settles.
- How code registers work for the end of a pass, such as one URL update.
- `flush()` from brumate/signals.

## Behavior

- Memos stay eager inside a pass. Bindings run once, at the end, in the order of the graph. Effects run after them.

## Stub

None. search-params starts once the contract is frozen, and builds against the signatures. It integrates when batching is done.

## Contract tests

The batching tests in packages/brumate/test/resume.test.ts.

## Changes

- v1: draft.
