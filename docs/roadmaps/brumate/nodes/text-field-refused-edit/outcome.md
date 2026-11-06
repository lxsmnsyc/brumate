# Outcome: text-field-refused-edit

## Built

- Runtime (`brumate`): an internal hook, no public API. `whenSettled()` returns a promise that resolves when the setters of `$bind(signal, setter)` that were called so far have settled, and `undefined` when none runs. `send` in `client/updates.ts` passes the result of each setter call to `track` in `client/references.ts`: the result of `callNow`, the promise of `call` for a setter whose code has not loaded or that waits for an earlier call, and the return of a plain function binding. `track` holds a gate promise until a promise result settles. The gate never rejects, and the error goes on through the promise that `then` returns, so it is reported once as before. The runtime registers `whenSettled` under `Symbol.for('brumate.settled')`, as `flush` does, and `fields.ts` reads it through the symbol, so a part works with an older runtime (it then keeps the typed text, as before). `track` and the registration sit behind `HAS_BINDINGS`, so an app that passes no `$bind` to a component drops them from its client build.
- @brumate/ui: `showKept` in `packages/ui/src/fields.ts`. TextField (also for TextArea) and SearchField call it after the write with the typed text and a reader of the value.
  - `settled()` gives `undefined`: the setter refused or accepted at once. If the input still shows the typed text and the value is another text, the input gets the value at once.
  - `settled()` gives a promise: the input stays as it is. When the promise settles, the same check runs. A setter that accepted later changed the value, and the input follows it, so nothing is written. A setter that refused leaves the value, and the input gets it.
  - Each input counts its edits. A check acts only if no later edit started, so a keystroke that comes while a check runs is never overwritten. The later keystroke waits for the same setters, so its own check follows.
  - The input is touched only when it still shows the typed text, so a value from the caller, a reset or a form-reset hook is not overwritten.
  - Caret: read at the restore, so it is where the user moved it. `fitCaret` maps it to the kept text: the same place from the start when it is before the first changed character, the same distance from the end when it is after the last, and the end of the replaced part when it is inside. Set only when the input has focus and the type has a caret (email has none). The selection start and end map alike, and the direction stays.
  - TextField runs `recheck` after the restore, so the native message follows the shown text.
- Other parts need no change: they put the state back at once (`finally` after the write). Only a text input holds text of its own that the user typed, so only these two need to wait.
- Tests: `packages/ui/test/text-field-refused.test.ts` (sync refusal on TextField, TextArea and SearchField; caret; async refusal for TextField and SearchField; async accept; typing during a pending check). On main 4 of 5 fail; the async-accept test passes on main and guards the restore from dropping typing. `packages/brumate/test/call-now.test.ts` covers `whenSettled`. E2E step `TextField: a setter that refuses a letter shows the kept digits` in the ui suite, with a digits-only field on the example page (`examples/ui/src/routes/index.brm`); it fails on main.
- Docs: `website/ui/state.md` (exception removed), `website/ui/text-field.md`, `website/ui/search-field.md` (the known-gap text and the stale `onChange` line), `docs/decisions.md`. Changesets: `text-field-refused-edit.md` (@brumate/ui, patch) and `settled-setters.md` (brumate, patch).

## Deviations

- The brief owns no paths, and the change needs a small runtime hook, since a component cannot see the promise of its setter. It is internal (a symbol, no export, no types), so no public API is added.
- `website/ui/text-field.md` and `search-field.md` said `onChange` runs also when the request refuses. Since #372 a refusal gives no call, so the lines are fixed.

## Stubs left

- None.

## Gotchas

- A setter that rounds at once and keeps another text: the runtime writes the kept text into the input in the same flush, so the caret goes to the end there (not touched by this change).
- The check waits for every setter call so far, also of other parts. A slow setter of another field delays the restore. The input is not wrong in that time, it shows what was typed.
- Happy-dom and Chrome agree on the caret. On macOS the Home key does not move the caret in Chrome, so the e2e step uses ArrowLeft.

## Proposed learnings

- A part cannot see the promise of its setter | use the `brumate.settled` hook to wait for a setter before it restores a native input | packages/ui/src/fields.ts | no

## Verification

See `log.md`.

- Client gzip -9, clean rebuilds, main vs this branch: examples/ui 199354 B to 199931 B (+577 B, with the added example section), examples/todos 39361 B to 39360 B (-1 B).

## Size

- Estimated S, actual M (runtime hook, two parts, tests, docs).
