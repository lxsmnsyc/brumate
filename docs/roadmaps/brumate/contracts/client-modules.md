---
name: client-modules
version: 1
status: draft
defined_by: split-client-runtime
---

# Contract: client-modules

## Purpose

The modules that split-client-runtime makes from packages/brumate/src/runtime/client.ts, so the nodes after it own the right files.

## Interface

Proposed map, which split-client-runtime confirms or changes before it freezes this contract:

| Module             | Holds                                                                | Owned later by                       |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------ |
| client/updates.ts  | `run`, `memo`, `writeSlot`, `flushEffects`, the `g` tables           | ordered-updates (batching shares it) |
| client/resume.ts   | `init`, `parseId`, `readRecord`, `addScopes`, the bound-field writes | fields-typed-early                   |
| client/handlers.ts | `handle`, `call`, `resolve`, `fail`                                  | batching                             |
| client/blocks.ts   | the marker observer, inserts, blocks                                 | client-size/drop-marker-index        |
| client.ts          | re-exports, so callers do not change                                 |                                      |

## Behavior

- No behavior changes. No test changes.
- The bundle size of the core does not grow.

## Stub

None. The nodes that own these modules wait for the split.

## Contract tests

The whole suite of packages/brumate.

## Changes

- v1: draft, from the adversarial review.
