---
name: dock-call-record
version: 2
status: frozen
defined_by: dock-call-data
---

# Contract: dock-call-record

## Purpose

The record of a server call that the panel keeps in dev. `dock-call-data` fills it and `dock-call-detail` shows it.

## Interface

Final type, in `packages/brumate/src/runtime/devtools.ts` next to `CallTiming`. `CallTiming.record?: CallRecord` holds it; it fills in after the answer arrives, so a row can show before its record.

```ts
interface CallRecord {
  name: string;
  args: unknown[];            // decoded in the browser, cut
  result?: unknown;           // decoded in the browser, cut; absent for an error or a redirect
  error?: { message: string; stack?: string }; // dev server: the real message and the server stack
  timing: { module: number; network: number; server: number; decode: number }; // ms
  server?: ServerRecord;      // absent when the answer did not come from the dev server
}

interface ServerRecord {
  reads: string[];            // server functions whose memos the answer asked to load again (refresh)
  calls: string[];            // IDs of the server functions the function called
  logs: { level: string; text: string }[]; // console.log/info/warn/error/debug, in order
  truncated?: boolean;        // logs were left out to fit the header
}
```

`timing`: `module` is the time from the code of the handler being ready to the request leaving (loading the call code, writing the arguments), 0 outside a handler; `network` is the round trip without `server`; `server` is the `Server-Timing` of the dev server; `decode` is the time to read the answer.

## Behavior

- The dev server sends `server` and the real `error` in the `x-brumate-dev` header (URL-encoded JSON, at most 6000 characters; logs and the stack are dropped to fit). A production server never sets it, and the code is not in the client build (a test builds and checks).
- The browser decodes the arguments and the result itself (`readCall` in `devtools-calls.ts`).
- No cookies and no headers are recorded. Text is cut at 1000 characters, stacks at 2000, lists and objects at 50 items, depth at 5.
- `calls` leaves out the call the browser made; a server function that calls itself is listed.

## Stub

A fake record in the tests of `dock-call-detail`.

## Contract tests

`packages/brumate/test/devtools-calls.test.ts`.

## Changes

- v1: initial.
- v2: the final type, written by `dock-call-data` and frozen. The header drops `reads` and `calls`, then cuts the message, when it is still too long.
