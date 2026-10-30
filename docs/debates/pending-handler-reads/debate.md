---
goal: Decide how a brumate handler or $client callback that reads an async memo with no value yet behaves, so reads stay sound without breaking common patterns or growing the client much
date: 2026-10-30
rounds: 2 of 2
status: approved
roadmap: docs/roadmaps/brumate (node streamed-memo-reads, PR #352)
supersedes: none
decision: docs/decisions.md (entry added by PR #352)
---

# Debate: pending memos read by handlers

Options weighed: an implicit wait in the handler queue (the proponent, after the maintainer's first lean), a throw by default (Solid 2, J12), passing the promise (Marko 6, J13), and an explicit wait. The maintainer chose the explicit wait after the rounds (Q7), from Solid 2's `resolve` (J17).

## Settled structure

Explicit waiting. A read never gives a promise or `undefined` typed as the value. Code that wants to wait says so with `$resolve`.

1. **`$resolve(memo, { timeout?, signal? })`** in `brumate/signals` returns `Promise<T>` (Q7, J17, O8).
   - It resolves when the memo is no longer pending: at once when the value is settled, and after the load when the memo loads its first value or loads again (Q8, J17). If the memo's inputs change while it waits, it waits for the load that matches the current inputs; a superseded load never resolves it.
   - So writing an input and then awaiting `$resolve` gives the result for the new input.
   - It rejects with the memo's error, on `timeout`, or on `signal` abort.
   - It cannot be called where a memo computes or markup renders, as in Solid.
   - A plain read in a handler gives the last value, which can be stale while the memo loads again; `$isPending` is true then (P3). The `$optimistic` sample reads `shown` this way and keeps its guesses.
   - Once `$resolve` returns, a later handler can still change the inputs before this one reads more. The docs say so.
2. **BRM182 stays** for reads the compiler sees in a handler, a handler prop of a component, a `$client` callback, or a function in the same script that they call (J6). Such a read of an async memo with no value yet is an error unless:
   - it is guarded by `$isPending`, or
   - it is written as `await $resolve(m)`.

   Two fixes from the review of #352:
   - memos of imported `'use server'` functions count as async (J8);
   - a memo that markup reads outside `#loading` counts as having a value, because the server waited for it (J7). This makes the `forms.md` sample compile.
3. **The runtime throws for reads the compiler cannot see**, into the nearest `#try`, with a message that points to `$resolve` (P4).
   - Examples: function props, imported helpers, code after an `await`.
   - The check uses the slot value, not a handler counter, so reads after an `await` are covered (J8).
   - Code that updates the page is exempt (P11, O1, O11). The exemption covers the update run inside `queue()`, `refresh()` through its `refreshing` flag, and children rendered once their code loads. That code reads the promise there, as on main.
4. **Effects skip a run** that reads a memo with no value. They run again when its promise settles, also when it rejects, so the error reaches `#try` (J6, P4).
5. **`$client` callbacks count as handlers** (J6).
6. **Promise props and promise signals the server streams are async values**, as main already treats them (J16, P12). A promise that browser code writes into a signal later stays a plain value. A promise prop keeps its `Promise<T>` type, and a compile rule requires `$memo(prop)` in the child before it is read (Q6, O12).
7. **Docs and decisions.**
   - `docs/decisions.md` gets one entry. Its line 27 is corrected: `await $memo` does not wait yet in a component that the browser renders (J5).
   - `async-data.md` replaces the "Reads while a memo is pending" section, and the line that calls promise props plain values.
   - `effects.md` documents skip and rerun.
   - The `forms.md` sample stays as written.

Shipping: rework PR #352 on its branch for 0.4.0 with parts 1 to 5 and 7. Part 6's compile rule for promise props is a separate node in the 0.4.0 cut, because it adds a new compile error to code outside handlers.

## Budget

- client-size: about +180 to +200 B gzip on todos over main. That is #352's measured +164 B (J9), plus the `$resolve` helper and the exemption (+29 B sketch, P11), minus #352's handler counter. Estimate; the rework measures it with `pnpm bench`.
- time: one rework of #352 plus one S node for promise props. No implicit wait, wait list, lanes or cap to build (Q7).
- tokens: one worker and one fresh review round for #352, one small node.
- soundness: no read returns a wrong value. A read the compiler sees is rejected at compile time unless guarded or awaited. A read it cannot see throws. The one known gap is a quick click on a browser-rendered component before 0.5.0's browser await (J5), and it throws rather than returning a wrong value.

## Rejected

- Implicit wait before the handler queue (P1, P2, P5, P13, P14): sound for a click. But it holds every later click on the page (O2), needs a bound that the page `load` event cannot give (O9, measured in Chromium), and costs about +290 B. The maintainer chose explicit waiting instead (Q7).
- Lanes per form or component (P9): break the order between components that main keeps (O10).
- Waiting for every loading memo in scope (P7) or in the own component (O13): both over-wait. O13 was also rejected by Q5.
- Keeping #352's throw with no way to wait (P8): a quick click shows an error and the author has no fix but `$isPending` (Q1, Q2). `$resolve` is that fix.
- A cap on an implicit wait (O3, P10, Q4): nothing to cap once waiting is explicit. A `$resolve` call takes its own `timeout`.
- Passing the raw promise to handlers (Marko 6, J13; main today, J1): breaks decisions.md:26 and types the promise as the value.

## Proofs

- none. O9 ran a Chromium test of `load` after a cut stream (evidence/opponent-load-test/).

## Prior art

- React `use` suspends rendering, so handlers exist after their data. Promise props are plain values that handlers can await (J10).
- React 18 selective hydration replays a click after its boundary hydrates (J11). This was the model for the implicit wait, which lost.
- Solid 2: reads throw before the first value, including untracked ones. `resolve(fn)` and `until(fn, { timeout, signal })` are the explicit waits (J12, J17).
- Marko 6: a promise is a plain value, and only `<await>` unwraps it (J13).
- Svelte 5 (experimental async): content mounts after its first value. Handlers of pending values are not documented (J14).

## Open risks

- A browser-rendered component's `await $memo` does not wait (J5). Covered by the 0.5.0 node browser-await-spike, which also checks Compostate's `toResult`. Until then the read throws.
- A cut server stream leaves `#loading` bodies and effects pending forever (O7, O9), as on main. Accepted for 0.4.0; worth a node to reject pending state promises when the stream or the navigation reader ends.
- An async handler that awaits `$resolve` runs its rest after later handlers (O14). Accepted: the author chose to wait.
- The markup-read exemption in BRM182 assumes a server render. In a browser-rendered component, the read can still throw at runtime (J5). Accepted until browser await.
- BRM182 guard forms it does not recognize yet: `const p = $isPending(m); if (p) return;`, `continue`/`break`, and if/return/else (review of #352). These are false positives; fix them in the rework.

## Answers from the user

- Q1, Q2: the ideal behavior wins over 0.4.0 speed.
- Q3: wait at most until the page loads, or a few seconds for loads the browser starts. Superseded by Q7.
- Q5: an exact per-handler list. Moot under Q7.
- Q6: promise props keep `Promise<T>`, and must be read through `$memo` in the child.
- Q7: explicit waiting with `$resolve`, and BRM182 stays.
- Q8: `$resolve` waits until the memo is no longer pending, as in Solid; a plain read gives the last value, which can be stale.
- Approved by the maintainer on 2026-10-30.

## Overruled

- P1, P2, P5, P10, P13, P14, O3: upheld or open by the judge, rejected by the maintainer for explicit waiting (Q7).
- O8: rejected by the judge after its author withdrew it, adopted by the maintainer as `$resolve` (Q7, J17).

## Cost of this debate

- 2 rounds, about 400k tokens: proponent and opponent on Opus, plus the judge's framing.
