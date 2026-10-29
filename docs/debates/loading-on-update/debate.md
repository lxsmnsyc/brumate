---
goal: Decide how a #loading boundary in the browser treats a memo that loads again
date: 2026-10-29
rounds: 2 of 2
status: proposed
roadmap: none
supersedes: none
decision: none
---

# Debate: how a `#loading` boundary treats a memo that loads again

Options: (A) a `$fresh` memo primitive, (B) a new boundary block, (C) an opt-in on `#loading`, (D) today's stale content.

## Settled structure

Option C. `#loading (memo) { … } #else { … }` names the memos that re-arm the boundary, as Solid 2's `<Loading on>` does (J10). Without a header, nothing changes: the body keeps stale content (J1).

1. **Fix the header bug on main** (P2). Today `#loading (expr)` parses and type-checks, but the server drops the boundary and the fallback (J5). Ship it from main as its own PR. The fix is either to make codegen honor the header or to make it a compile error until step 2 lands.
2. **Client re-arm** (P9, P10, amended by O1, O2, O4, O9):
   - Only a `#loading` with a header writes markers in the settled path. The markers carry the scope ID, the anchor and a first-settle bit (O1, O9).
   - The boundary subscribes to `pending()` of the named memos. It does not catch `NotReady`, because a reload never throws (O2, J12).
   - It arms only after `pending()` has been false once, so a value the server is still streaming does not show the fallback over a body that was swapped in (O4).
   - While a named memo loads, it hides the body with `hiding` and keeps it alive, the way `#offscreen` does, and renders `#else`. It swaps back when the value arrives. It calls `hiding` directly, with no synthetic `#offscreen`, so scope IDs match the server render (P10, O5 rejected).
   - The `#else` body ships to the browser only for header blocks, behind a `features.ts` flag (J3, J7).
3. **Docs and tests** (P4 without the DEV warning, O3):
   - Replace async-data.md:77.
   - Add a decisions.md entry.
   - Test that a second load shows `#else`, then restores the same DOM nodes and input state.

The fallback shows at once, with no delay (P11 and O11). React's 300 ms throttle delays revealing content after a fallback, not showing the fallback. Vue's `timeout` keeps old content until it expires. A delay brings back the stale content this feature exists to remove. If one is ever needed, it can be added later as an opt-in without breaking anything.

## Budget

- device: about 0.7 kB gzip plus the `#else` body, only in apps that use a header; 0 bytes for other apps (P12, O12, J7). Each header block adds a short marker to its HTML.
- time: three PRs; step 1 does not wait on the others (P2, P12).
- tokens: about 15k for step 1, about 13k for step 3, plus step 2's implementation with about 20k tokens of runtime to read (P12, J9).

## Rejected

- A, `$fresh`: a read in a handler or an effect has nothing to catch it, and the choice sits in the script instead of where the fallback is written (O6).
- B, new block: same runtime as C plus a new keyword, next to an existing `#loading` header that does nothing (P6, J5).
- D, keep stale content: styling covers refresh-style cases but not bodies with editable controls or actions bound to the old record (P8, O13).
- Lowering to `#offscreen` + `#if` in the compiler: the wrapper shifts scope IDs against the server render (P10).
- DEV warning for reads outside the boundary: brumate has a pending flag, not a throw that holds the frame, so a read outside the boundary cannot keep the fallback from showing (O3).

## Proofs

- none

## Prior art

- Solid 2 `<Loading on>`: keeps content through a refetch by default, re-arms per boundary through `on`, and keeps children alive behind the fallback (J10).
- React, Solid 1.x: show the fallback again on update unless the update runs in a transition. Svelte 5 shows pending only on the first render. Vue re-enters pending only when the root content is replaced, with an optional `timeout` (J11, O11).

## Open risks

- `hiding` may not find a `#loading` body that streamed in (O10). Streamed body scopes carry their parent and resume links them into `children` (J14), but the kind match is untested. Spike: the first test of step 2.

## Answers from the user

- Is `#if ($isPending(x))` inside a `#loading` body acceptable? No; `$isPending` is for styles (Q1).
- Is styling stale content enough? The debate must decide whether `#loading` shows only fresh UI; it decided yes, as an opt-in (Q3).
- Delay before the fallback? The debate must decide; it decided none (Q2).

## Overruled

- none

## Cost of this debate

- 2 rounds, about 217k tokens
