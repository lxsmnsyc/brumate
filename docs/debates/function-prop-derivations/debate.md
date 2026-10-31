---
goal: Decide how brumate tells a function prop that derives a value (so the child updates when the state it reads changes) from a handler prop, a new primitive that marks derivations or compiler inference
date: 2026-10-31
rounds: 2 of 2
status: approved
roadmap: docs/roadmaps/brumate (node function-prop-reads, PR #395)
supersedes: none
decision: docs/decisions.md (the function prop entry of PR #395, rewritten after approval)
---

# Debate: function props, derivation or handler

Options weighed: a parent-side marker `$track(fn)` (P1, P2), fully explicit marking (P7), inference by reads only like effects (option B, P3 to P5), #395's write scan as built (P6), the write scan with tracked writes only (option C, O4), the maintainer's two paths (Q3): callers pass a value at the prop site (P14) and a child-declared type `Derived<F>` like `Bindable` (P11 to P13), and option C2 (O8).

## Settled structure

Compiler inference, with no new API. Option C2 ships in 0.4.1 on PR #395's branch.

1. **A function prop is live when its function reads state** (O8, O4). The compiler follows its reads through the functions it calls, and reads inside `$untrack` do not count. When that state changes, the parent sends the child a new bound function, so the child's memos, markup and effects that call it run again (J2).
2. **It stays fixed, as on 0.4.0, when any of these holds** (O8):
   - the function or a callee writes state outside `$untrack`. A write inside `$untrack` no longer counts, which fixes J4 and matches effects.md (J9);
   - the function or a callee calls through a context value or a prop outside `$untrack`, since the compiler cannot see whether that call writes. This stops the hidden-writer loop of P9;
   - the attribute is an event (`on` plus a capital letter, J3).
3. **The author's way out is the one effects already teach** (O4, J9): wrap an incidental write in `$untrack`, and the function becomes a live derivation.
4. **On real code** it emits the same as #395: across ui, examples, website and benchmarks only FormSignupDemo's `validate=matches` changes, which is the fix (J7, O8). 22 diff lines on #395, no API, 0 B client change on real code.
5. **Two bugs on main, each fixed from main in its own PR**, not on #395:
   - `<Child label=$untrack(nameOf) />` drops `nameOf` from the client and turns a handler's `name = 'Grace'` into `('Grace')` (P8, J14);
   - an effect that calls a context's writer reruns without end, because the context is re-sent when the state it reads changes (O7, O12). This one breaks Q4 on 0.4.0 already.

## Budget

- time: about 0.5 day on #395's branch for C2, plus its tests (the P9 context loop, the regLoop callback loop, the J4 `$untrack` write) (O8, O11).
- tokens: one worker round and one fresh review on #395; two small main fixes later.
- client-size: 0 B on real code; one update function and one table entry for each live function prop (J2), and none for callbacks that stay fixed (O3).
- soundness: no loop through a function prop for the callback shapes measured (regLoop, the context writer, module writers). A derivation that reads through a context or prop function stays fixed, as on 0.4.0; the repo has none (O8).
- learnability: no new export. The rule is "a function prop that only reads is live; wrap a write in `$untrack`", the same advice as for effects (J9).

## Rejected

- `$track(fn)` (P1, P2): its target, function members of object props, has 0 cases in the repo, and the maintainer called it rare (Q1, O5). The analysis can lose it as Svelte 4 lost reads behind functions (O6).
- Option B, reads only with no write scan (P3, P4, P5): an effect calling a parent's writer looped 51+ times with no depth guard (O1), and it changes no real code beyond #395 (O2).
- #395's write scan as built (P6): a write inside `$untrack` freezes the prop (J4); C keeps it and fixes that (O4).
- Option C alone (O4): still loops when a callback writes through a context function (P9); C2 adds that rule.
- Callers pass a value at the prop site (P14, the maintainer's path a): 63 ui function props take arguments from the child (`validate`, `isDateUnavailable`, `filter`) and cannot be passed as values, and J1 stays unfixed for them.
- A child-declared `Derived<F>` type (P11 to P13, the maintainer's path b): the child only sees a literal function type, so an alias, a union with `undefined`, a method signature, untyped `$props()` and an imported props type all still loop (O9). A forgotten `Derived` brings the stale value back silently (O10).
- Fully explicit marking, no fix in 0.4.1 (P7, P16): ships no fix for J1 and changes behavior twice (O11).

## Proofs

- none ordered. Both sides measured in scratch copies of the compiler outside the repo: option B and C patches (evidence/opponent-option-b.md), the `Derived` prototype (evidence/proto-b-_.diff), and C2 (evidence/opp-c2-_.diff), each against resume.test.ts (407 to 410 tests).

## Prior art

- React Compiler replaced the manual `useMemo` and `useCallback` markers with inference; `useEffectEvent` kept an explicit marker for the reverse case, a function an effect must not depend on (evidence/prior-art.md).
- Solid and Svelte 5 track a function prop at the call site at runtime, with `untrack` to cut reads, and no marker on the function. Svelte 4's compile-time `$:` missed reads behind functions, which led to runes (O6).
- Marko 6 infers closures and their reads at compile time, as brumate does.
- Lab: pending-handler-reads (J13) chose explicit `$resolve` over an implicit wait; here inference wins because the marker forms either had no target (Q1) or failed on common typings (O9).

## Open risks

- A callback that writes through code the compiler cannot see and that is neither a context nor a prop call, such as a store imported from a `.ts` file or the DOM, still counts as a read-only derivation and can loop in the Q4 shape (O8, J8). Accepted for 0.4.1; worth a probe on #395's branch.
- The client has no update-depth guard, so any loop hangs the tab where Svelte 5 and React throw (O1). Worth a node: a depth limit that throws into `#try` with a message pointing to `$untrack`.
- Function members of object props stay fixed (J5). Accepted by Q1; the docs say to pass such a function as its own prop.

## Answers from the user

- Q1: functions inside object props are rare; no marker for them.
- Q3: weigh calling at the prop site and a child-declared type like `Bindable`.
- Q4: callbacks under names without `on`, called from a child's `$effect`, are common and must never re-send or loop.
- Q2: live by default for functions that only read (option C2), confirmed with the approval.
- Approved by the maintainer on 2026-10-31.

## Overruled

- none yet.

## Cost of this debate

- 2 rounds, about 290k tokens: proponent and opponent on Opus, plus the judge's framing and rulings.
