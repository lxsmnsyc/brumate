---
id: effect-copy-warning
title: A warning for an effect that only copies signals
status: done
priority: must
type: feature
story:
early: false
outline: false
milestone: 0.9.0
target: 
ship: auto
land: auto
from: 
size: S
spike: false
hypothesis:
verify: cd packages/brumate && npx vitest run test/effect-copy-warning.test.ts test/check-command.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent: 171000
owns: []
shared:
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/src/check-command.ts
  - packages/brumate/src/error.ts
  - packages/brumate/src/vite.ts
  - packages/language-server/src/diagnostics.ts
  - packages/brumate/test/effect-copy-warning.test.ts
  - packages/brumate/test/error-codes.json
  - website/docs/effects.md
  - docs/decisions.md
  - .changeset/*.md
reserves: [code BRM209, code BRM210]
provides: []
depends_on:
  - on: async-effects
    kind: hard
    why: both edit declareEffect in analyze.ts and the effects docs, and an async effect callback is legal after it, so the check must stay quiet on one that has an await
---

> 2026-11-18: refined from the outline. A must feature of 0.9.0 (docs/debates/0.9.0-cut/debate.md).

# A warning for an effect that only copies signals

## Goal

The analyzer warns when an effect only assigns signals that nothing else writes, and names the `$memo` that replaces it, with the form `const message = $memo(...)` when the effect has one assignment and no `if`. `brumate check`, the language server and the dev server show it, with the code `BRM209`. Rules: [Effects that only copy signals](../../../../proposals.md#effects-that-only-copy-signals).

## Current state

- Warnings are reported with `this.report('warning', message, range)` (`packages/brumate/src/analyze.ts:795` for the Bindable prop, `:1841` for `$client` with `"load"`). They carry no code.
- The writes of each name are collected in `declaration.writes`, and each write holds its `site` (`analyze.ts:2385`). The Bindable warning already uses them (`analyze.ts:788-800`).
- `declareEffect` creates the `effect` site for `$effect` (`analyze.ts:1820`). `$searchParam` creates an `effect` site too (`:1320`), which the check must skip.
- Codes attach to errors only: `check-command.ts:71` calls `findError` when `severity === 'error'`, `packages/language-server/src/diagnostics.ts:13` does the same, `error.ts:48` (`withCode`) works for any message, and `vite.ts:2528` prints warnings without a code.
- The catalog is `error-catalog.ts`. The last pinned code is `BRM207` (`test/error-codes.json`). `BRM208` is reserved by module-signals, so the next free number is `BRM209`.
- The docs already explain the misuse: `website/docs/effects.md:42` ("When you do not need an effect").

## Prior art

Pinned SHAs: React [6ff2574](https://github.com/facebook/react/tree/6ff257439b3919fc8dcc643b635e09d62fa74d0e), Svelte [dd3f1c2](https://github.com/sveltejs/svelte/tree/dd3f1c2ad9017380836410a63fe53cd4a8a1b9ba), Solid [82f71fd](https://github.com/solidjs/solid/tree/82f71fddb1340cab46167db119da5702038e65ab), Vue [148fdac](https://github.com/vuejs/core/tree/148fdacdc3a67aaa2b8d1b615da227c3fcc2df53), silmaril [910f4c1](https://github.com/lxsmnsyc/silmaril/tree/910f4c1052b6be5ff5eb15690b21ede42ef06886).

| Rule | React | Svelte 5 / Solid / Vue / silmaril | brumate (this node) |
| --- | --- | --- | --- |
| What it finds | The compiler pass [`ValidateNoSetStateInEffects.ts`](https://github.com/facebook/react/blob/6ff257439b3919fc8dcc643b635e09d62fa74d0e/compiler/packages/babel-plugin-react-compiler/src/Validation/ValidateNoSetStateInEffects.ts#L41) flags a `setState` called synchronously in an effect body, because it "triggers a re-render". The lint rule of eslint-plugin-react-hooks and the docs "You might not need an effect" say the same. | None of them warns. Svelte documents `$derived` for it in its docs of `$effect`. | A warning, when the body only assigns signals. |
| Where a write is allowed | Any call counts as possible (React flags `setState` not under a callback). | n/a | Any call ends the check (rule 1 below), as the proposal says. |
| Value the user also writes | Not checked, so React warns on `setPage(1)` in an effect. | n/a | The second rule keeps it quiet: a signal written elsewhere is state. |
| Severity | Error under the compiler's validation, a lint error by default. | n/a | Warning only. Effects that write signals stay valid. |
| Fix text | Points to the docs. | n/a | Names the signal and gives the memo. |

## Decisions

- Code: `BRM209`, reserved here with `BRM210` as a spare. It is a catalog entry for a warning, so the catalog gets its first warning entry. The message has the form `"{name}" is written only by this effect. Use const {name} = $memo(...)`, with a second message for the cases where the memo form cannot be given (`if`, several assignments): `"{name}" is written only by this effect. Use a $memo`. Both messages match one entry, so the pin file holds the first text, and the catalog entry's `message` matches by `matchesError`. If two messages cannot match one entry, the second is a second code. The worker decides after reading `matchesError` (`error-catalog.ts:1245`), and takes `BRM210` only if it must. Otherwise `BRM210` stays unused.
- Show the code for warnings: `check-command.ts:71`, `language-server/src/diagnostics.ts:13` and the dev warning in `vite.ts:2528` look the entry up for any severity.
- The check runs after the writes are resolved, in the same place as the Bindable warning, on each `effect` site made by `$effect` (not `$searchParam`).
- Rule 1, the body: only assignments (`=`, `+=`, `++` and the like) to signals, maybe under `if`/`else` and inside blocks. It has no call (also `$untrack(...)`, a method call, a template tag), no `await`, no `return` of a cleanup, no loop and no `throw`. An async callback has an `await` or is rejected by the same rule, so it stays quiet.
- Rule 2, the writes: each assigned signal has no write outside this effect site. A write in a handler, a `$client` callback, another effect, a function the compiler sees, a `$bind` (also of a child) or a prop the component passes with `$bind` counts. A `let` prop the effect writes counts as written elsewhere (the parent can write it). The signal must be declared with `$signal` in the same component.
- The message is reported once per signal, at the assignment. An effect that assigns two such signals gets two warnings.
- It is a warning. No setting turns it off beyond what warnings have today (the worker checks and records it).
- Not planned: a ban on `$effect`. The overlay code of `@brumate/ui` writes signals elsewhere or calls functions, so it stays quiet. A test runs the check over `packages/ui` and the website and expects no new warning.

## Acceptance

- [ ] The proposal example warns, with `BRM209`, the signal name and the memo form, in `brumate check`, in the language server diagnostics and in the dev server output.
- [ ] Quiet cases, one test each: a call in the body; an `await`; a returned cleanup; the signal written in a handler, in a `$client` callback, in another effect, by `$bind`; the `page = 1` reset when a `query` prop changes; a `$searchParam` site.
- [ ] A warning case with `if`: the message gives no memo form. A warning case with two signals gives two warnings.
- [ ] `packages/ui` and `website` compile with no new warning of this code (or each hit is fixed in this node, listed in the outcome).
- [ ] `website/docs/effects.md` ("When you do not need an effect") mentions the warning and its code. `website/docs` errors page is generated from the catalog, so `BRM209` appears there. `docs/decisions.md` records the rules.
- [ ] A minor changeset. The pin file holds `BRM209`, added with `UPDATE_SKILL=1 npx vitest run test/check-command.test.ts`.
- [ ] Fast check passes: `cd packages/brumate && npx vitest run test/effect-copy-warning.test.ts test/check-command.test.ts`
- [ ] Before the pull request: oxlint, root `oxfmt --check`, typecheck, `pnpm test` at the root.

## Sizing

S: one check in the analyzer, one catalog entry, and the code shown for warnings in three places.

## Notes for the worker

- Run the check over `packages/ui` first. If a real component warns, the rule is too wide, so narrow it before you fix the component.
- Read the outcome of `async-effects` first: an async callback is legal there, so read what it decided.
