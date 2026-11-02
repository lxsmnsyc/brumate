# Outcome: promise-in-markup

## Built

- A promise in text or an attribute value renders the value that it settles to, on the server and in the browser. A spread follows the attribute rule.
- Server (`packages/brumate/src/runtime/server.ts`, `codegen/markup.ts`, `codegen/scopes.ts`):
  - Text inserts already waited for a thenable. `attribute` now waits too, `spread` waits for thenable values, and a dynamic element waits for its spread. The codegen wraps attributes (not primitives) and spreads in `ready`, so an element is sent with its final attributes.
  - Outside every `#loading`, the page waits for the promise. Inside one, `mayWait` now counts an insert or attribute whose value can be a promise (`mayBePromise`), so such a body shows its `#else` and streams once the promise settles, as a body with a component does.
- Browser (`runtime/client/waits.ts`, `codegen/template.ts`, `codegen/client.ts`):
  - `mayBePromise(node, site)` (scopes.ts) marks a value that can be a promise. That is a call (not a `$` macro, `String`, `Number` and the like, or a string/array method such as `toUpperCase`), `new Promise`, a tagged template, a prop typed `Promise`, an object literal that holds one (spreads), and the branches of `?:`, `&&` and `??`.
  - Only those writes change. Cloned renders use `keepValue` (text and last text), `fillValue` around `setAttr`, `setContent` and `putText`, and `fillSpread`. Updates use `fillValue` around `text`, `content` and `attr`, and `fillAttrs` for spreads.
  - `fillValue(id, key, value, write)` writes a non-thenable at once. A thenable goes through `fillSettled`, so it counts in the boundary of the render (`join`, `leave`, `failOnce`). The scope keeps the latest value of each place in `Scope.q`, keyed by anchor or `anchor name`, and an older promise that settles later writes nothing.
  - The pending state is in the scope. There is no new hold-back helper.
- Compile error BRM188 (`analyze.ts` `checkPromises`, error-catalog.ts, test/error-codes.json, website/docs/errors.md, skills/brumate/references/errors.md). It covers an event handler or handler prop, a `#for` key, and `$bind` or `ref` of a prop typed as a promise. It fires when the compiler sees a promise there: `new Promise`, `Promise.x()`, `fetch()`, a server function, an import of a `'use server'` file, an async function of the file, or a prop typed `Promise`.
- Dev runtime errors that cite BRM188: a `#for` key that is a thenable (lists.ts), and a handler prop that is one (handlers.ts).
- Tests:
  - `test/resume.test.ts` has `describe('a promise in markup')` with 10 tests: server text, attributes, booleans, null and spread; a streamed `#loading` body with its final attributes; no second call on resume and a call on a signal change; a browser-rendered component that holds until text and attribute settle; an update keeping content with the latest winning out of order; a browser `#loading` fallback; a rejection to a server `#try`; a spread on two elements; the dev `#for` key error; a typed promise prop in text.
  - `test/diagnostics.test.ts` has 2 tests for BRM188.
  - Fixtures are in `test/render/`: `markupData.ts`, `markupServer`, `markupServerLoading`, `markupResume`, `MarkupKid`, `markupHost`, `markupLoadingHost`, `markupTry`, `markupSpread`, `markupKey`, `PromiseTextKid`, `promiseTextHost`.
- Snapshots: 9 render and inspect snapshots take the server `ready` wrap of attributes and the `fillValue` and `keepValue` writes of values that call code.
- Docs: website/docs/async-data.md has a new section, "Promises in markup". docs/decisions.md has a new entry after the promise prop decision.
- Changeset: `.changeset/promise-in-markup.md`, minor.

## Deviations

- Server `#loading`: the server cannot tell a settled promise from a pending one. So a body whose values can be promises always streams, even when the value is not a promise, such as `{formatDate(d)}`. The alternatives were a speculative in-place render, which runs the expression twice or needs a child context merged into the page. The changeset and docs say so.
- Browser: there is no thenable check on every write. A first version checked in the update helpers, and that put `fillSettled` and its chain into the core of every page: +255 B gzip on todos. The browser now waits only where the compiler marks a value. A plain read of an untyped prop, a signal or a local variable that holds a promise still renders nothing in a browser render. Typing the prop or using `$memo` fixes it, and the docs say so.
- Outside every `#loading`, the browser counts the promise in the root boundary only in builds whose root wait flag is on (some browser render awaits). In other builds the value fills in place, as `countLoads` and `fillSettled` memos already do.
- Contract: no change request. `fillValue`, `keepValue`, `fillSpread` and `fillAttrs` are additive exports of waits.ts, built on `fillSettled` and `join`. The frozen interface is unchanged.

## Stubs left

- None.

## Gotchas

- Element event handlers have no dev runtime check. Their compiled call throws the browser's TypeError. Handler props and `#for` keys have the check.
- The browser's HTML-string render path does not wait. That is markup the clone cannot take, such as a `<template>` element. A promise there renders empty, as #419 noted for memos.
- `mayBePromise` is a name rule. A sync helper call counts as a possible promise. In the browser that costs one `fillValue` call. On the server it makes a `#loading` body stream.
- BRM188 sees only the forms listed above. A promise from an imported plain function or a method is not reported at compile time.
- templates.ts cannot import waits.ts (cycle through components.ts). The promise-aware variants live in waits.ts, which imports templates.ts and inserts.ts.

## Proposed learnings

- The browser waits for a value of markup only where the compiler marks it as a possible promise | a thenable check in the shared update helpers pulls the boundary code into the core of every page (+255 B gzip on todos) | packages/brumate/src/codegen | yes

## Verification

- All 12 new tests fail on origin/feat/browser-async at 2b1d12ca, run in a scratch worktree with the same fixtures. The reviewer reproduced this. All pass on the branch.
- `pnpm install`, `pnpm build`, `pnpm lint` (no errors), `pnpm format:check`, `pnpm typecheck` and `pnpm --filter brumate test` pass: 67 files, 2142 tests after the merge. One earlier full run failed only on load (the resume.test.ts `beforeAll` timed out at 10 s with a load average of 33). The file passed alone, and the next full run passed.
- Review round 1 (fresh reviewer, pr-review) found one should-fix: `fillSpread` keyed its places as `s name`, which collided between two elements of one scope and did not match `fillAttrs`. The fix is 8a1f43b6, with a two-element test. Three non-blocking items stay as the gotchas above. Round 2 was clean.
- Merges of origin/feat/browser-async:
  - a33bfaf7 (browser-try, wait-later-memo-update): conflicts in `runtime/client.ts` (the waits.ts export list: kept `attempt` and the new exports) and `test/resume.test.ts`. There I took their file and appended this node's describe, with the `MarkupLoad` import. Each describe is closed.

## Size

- Todos, `pnpm bench --only brumate --scenario todos`, JS before `load`, same machine and run conditions: base 33,120 B raw / 13,839 B gzip, branch 33,038 B / 13,836 B (13.5 kB). Click checks pass. The first version with checks in the update helpers was 33,778 B / 14,094 B.
- Rows, `pnpm bench --only brumate --scenario rows`, median ms, branch vs base, machine busy:
  - create 1,000: 30.1 vs 23.4
  - replace: 37 vs 31.9
  - update every 10th: 13.3 vs 13.8
  - select: 1.4 vs 2.1
  - swap: 4.8 vs 6.8
  - remove: 6.7 vs 9.1
  - create 10,000: 284 vs 375
  - append: 43.3 vs 47.2
  - clear: 4.7 vs 5.2
- The rows app has no value that can be a promise, so its compiled code and the runtime paths it runs are the same as the base. The differences go both ways and are noise. The thenable check costs nothing on rows: there is none on a plain write. A write that the compiler marks pays one `isThenable` check and a `scope.q` read in `fillValue`.
- Estimated S (browser) to M (server), actual M.
