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

To be frozen by batching. It must define:

- When a pass starts and ends: a handler up to its first await, a `$client` callback, a run of effects, a value that settles.
- How code registers work for the end of a pass, such as one URL update.
- `flush()` from brumate/signals.

## Behavior

- Memos stay eager inside a pass. Bindings run once, at the end, in the order of the graph. Effects run after them.

## Stub

search-params can write the URL on each write until the contract is frozen, and move to the end of the pass after.

## Contract tests

The batching tests in packages/brumate/test/resume.test.ts.

## Changes

- v1: draft.
