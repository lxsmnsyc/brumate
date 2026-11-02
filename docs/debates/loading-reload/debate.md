---
goal: Decide how a #loading boundary in the browser shows its fallback when data under it loads again, on the current runtime
date: 2026-11-02
rounds: 3 of 3
status: approved
roadmap: docs/roadmaps/brumate (node loading-on)
supersedes: docs/debates/loading-on-update/debate.md
decision: docs/decisions.md (the #loading header entry, 2026-11-02)
---

# Debate: a `#loading` fallback when data loads again

This debate supersedes loading-on-update. Two of its facts were wrong: a read of a value that is still loading has a defined path everywhere (J1, its O6 said a handler or effect had nothing to catch it), and Solid 2's `on` names inputs whose writes re-arm a boundary, not memos (J3, its J10). The browser also has a pending boundary now (J4).

Options weighed: a Solid-style header of inputs (C, P1), a `$fresh` memo (A, P7, P15), a rebuild through `#key` (H, P8, P13), and a header that names memos (C', P9-P18).

## Settled structure

An author makes a memo's update show the fallback by naming the memo in the `#loading` header (J9, the maintainer's Q1).

1. **Syntax** (P9, P10, P18): `#loading (user, posts) { … } #else { … }`. Each name is a memo of the component or of a block script around the block, and markup in the body reads it; anything else is a compile error. The header replaces the `loading-header-error` compile error (J5).
2. **Trigger** (P10, P18, O14): once the body has shown, the boundary shows `#else` while a named memo, or a memo upstream of it, is pending, for any cause: an input write, an action's `refresh()`, a load the memo starts. The set is `[m, ...upstreamMemos(m)]`, the same one `$isPending(m)` reads (model.ts:234). Authors name the last memo of a chain: `#loading (posts)` also holds while `user` loads. The header is one more reader of the slot's pending state, so it needs no new subscription (P10, checked by the opponent).
3. **Hold** (O5, Q2, P17): the boundary calls the existing `hiding` on the body and renders `#else`. The hidden body follows the `#offscreen` rules: effects pause, `window`/`document` listeners stop, portals hide. Updates keep reaching it. It releases when no named memo is pending. There is no nested join (O9, O13): a branch that opens under the hidden body and loads its own data takes its own `#loading`, and the frozen client-pending-boundary contract does not change.
4. **Readers outside the body** do not change (P12): they read the old value with `$isPending` true, and BRM182 and the paths in J1 stay as they are.
5. **Server and resume** (P5, O7): a header block renders on the server as a block without a header, with a marker form that carries the scope ID and anchor. Only header blocks ship their markers and `#else`, behind a features.ts flag.
6. **Limits and checks** (O10, O11, P18): a memo that a child component loads for itself is not held; the child takes its own `#loading (m)`. A compile warning flags a named memo that is or reads a `$debounced` or `$throttled` memo. The docs say to keep the control that writes a named memo's input outside the body, since a hidden body loses focus.
7. **Identity change with fresh state** (P13, Q3): a docs idiom with no new syntax, `#key (id) { <script> const user = $memo(…) </script> #loading { … } #else { … } }`. It drops the body's input state, and a reload of the same id is not covered. A block-script memo inside `#key` compiles (checked by the opponent).

## Budget

- device (client bytes): up to about 1.3 kB gzip in apps with a header block and no `#offscreen`; about 0.3 kB in apps that ship `#offscreen`; 0 B on todos and in apps without a header (P19, O4). Only `hiding` is measured (935-955 B gzip, by proxy); the rest is an estimate. Apps without `#offscreen` exceed GOAL.md's 0.3 kB per change, so the node records the measured size for the maintainer (P19, O15).
- time: one M node, loading-on, after browser-loading-fallback, with the `#key` docs section in it (P19).
- tokens: about 450k for the node (P19, J7).
- semantics: the trigger is per memo, chosen by the author at the boundary; outside readers keep the old value (J9, P12).

## Rejected

- A header of inputs, as Solid's `on` (P1): the maintainer wants a memo update to trigger the fallback, not an input write (J9).
- Taking the body out of the page (P3): portals, listeners and effects keep running against the `#offscreen` rules, and updates that open branches are missed (O1, O2).
- Counting every pending slot under the body (P2): includes `$debounced` timers and memos only effects read (O3).
- A nested join of branches that open under the hidden body (P11): `join()` counts only inside the running render, and fixing that changes the frozen contract (O9).
- `$fresh` (P7, P15): with the trigger per memo it is the right granularity, but it still needs `hiding`, saves no bytes, makes BRM182 flag handler reads, and empties markup outside any boundary.
- Rebuilding the body inside the header (P8): drops DOM nodes and input state; the rebuild is the `#key` idiom instead (P16).

## Scope changes

- refine loading-on from this debate: one M node after browser-loading-fallback, with the `#key` idiom in its docs.

## Proofs

- none

## Prior art

- Solid 2 `<Loading on>`: a dependency list whose writes re-arm the boundary; any pending read under it shows the fallback; children stay alive; an outside read of the same data holds the frame (J3). Solid documents it as telling a navigation from a refetch (J8).
- React keys a Suspense boundary on the route, and transitions opt out of re-showing the fallback; Svelte 5 shows pending only on the first render (P1, P7).

## Open risks

- `hiding` on a `#loading` body that the server streamed in (carried from the superseded debate, its O10): the first test of loading-on.
- A branch that opens under the hidden body and loads with no `#loading` of its own shows as a second loading phase after release (O9, O13): accepted; a nested hold can be added later without a break.
- The size in apps without `#offscreen` is above the 0.3 kB rule (P19): measured in the node and decided by the maintainer then.

## Inferred choices

- A block script inside `#key` can declare a memo (P13): inferred from the docs, then confirmed by compiling a probe (evidence/opponent-key-memo.txt).

## Answers from the user

- Q1, should a refresh() show the fallback, or only an input change: neither fits; brumate has no way to make a memo update show the loading boundary's fallback, and the feature is that way.
- Q2, should the body behind the fallback follow the #offscreen rules: yes.
- Q3, weigh the #key rebuild: yes.

## Overruled

- none

## Cost of this debate

- 3 of 3 rounds, about 242k tokens.
