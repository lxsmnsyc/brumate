---
name: dock-call-record
version: 1
status: draft
defined_by: dock-call-data
---

# Contract: dock-call-record

## Purpose

The record of a server call that the panel keeps in dev. `dock-call-data` fills it and `dock-call-detail` shows it.

## Interface

Draft. `dock-call-data` fixes the exact type next to `CallTiming` in `packages/brumate/src/runtime/devtools.ts`.

```ts
interface CallRecord {
  name: string;
  args: unknown[];            // decoded in the browser, cut at a length
  result?: unknown;           // decoded in the browser, cut at a length
  error?: { message: string; stack?: string };
  timing: { module: number; network: number; server: number; decode: number };
  server?: { reads: string[]; calls: string[]; logs: { level: string; text: string }[] };
}
```

## Behavior

- `server` and `error.stack` exist only in dev; the dev server sends them back in a dev-only field.
- No cookies and no headers are recorded. Values are cut at a length.

## Stub

A fake record in the tests of `dock-call-detail`.

## Contract tests

`packages/brumate/test/devtools-calls.test.ts`.

## Changes

- v1: initial.
