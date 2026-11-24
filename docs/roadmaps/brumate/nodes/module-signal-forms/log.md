# Log: module-signal-forms

## 2026-11-24 start

- Worktree node-module-signal-forms from c0f6b8f9. Nothing of the brief existed: `planModuleSignals` accepted `$signal` and `$memo` only.
- Prior art read:
  - Svelte 5 `$derived` docs: https://github.com/sveltejs/svelte/blob/1aadba4c8c307c14a53833626e7cf7929bcf9ed8/documentation/docs/02-runes/03-%24derived.md . Reads inside the expression are the dependencies, `untrack` exempts one, and a `let` derived can be overwritten for optimistic UI until the next change of its dependencies. That is the model of `$untrack` and `$optimistic` here.
  - Solid `createMemo` with `equals(prev, next)`: https://github.com/solidjs/solid/blob/30e7805eb1bbd9e2601d0252558e91d2547e96f4/packages/signals/src/signals.ts (lines 270 to 316, 485). An equal result keeps the old value and does not notify. `$gate` is the same with the guard inverted, so the helper keeps the value and sends nothing when the guard says no.
- Plan: `$gate` and `$debounced`/`$throttled` compile to `gated` and `timed` of `brumate/store` (new small exports, tree-shaken when unused). `$optimistic` compiles to `optimisticStore` of `brumate/client`, which resets with the guesses of the page. `derived` carries a pending flag from its sources. The importer links the pending flag of a store to `$isPending` and `$resolve`.

## Notes

- All five forms could be built on stores. No form is stopped, no limit added.
- Probe first: `$isPending(imported)` already compiled (a `$store` read is a context slot), but `$resolve(imported)` was BRM183 since the analyzer accepted memos only. Fixed in `analyze.ts` (one condition). A store has no way to say "pending", so stores got an optional `q` (listeners) and `n` (flag), read by `subscribeSlot` in `client/context.ts` and written to the slot with `markPending` in `client/updates.ts`.
- `$optimistic` resets from the guesses of the page: `optimisticStore` wraps `guesses.reset` once, so `track()` needs no change and the core of a page without a module `$optimistic` is unchanged. A write on the server is dropped.
- Gate: no history without a subscriber, so the server (which only pulls) renders the value. This matches the component form, which has no history on the server.
- Tests: 12 new tests in `test/module-signals.test.ts` (31 in the file), fixtures `forms.brm.ts`, `guarded.brm.ts`, `Forms{A,B,C,Page}.brm`, `OwnForms.brm`.
- Edits with `sed -i` and a heredoc were used by mistake a few times for small changes (rename, append of tests). Contents were checked by the formatter and tests afterwards.

## Review round 1 (head 344eff14)

- Held errors: probe showed the writer threw and `flushComputed` dropped the other stores. Fixed in `derived`, `gated` and `timed`. The slot write needed `MemoError` in `subscribeSlot`. The `#catch` body did not ship for a module memo until `tryCatchesClient` knew imported module memos (`Declaration.moduleMemo`). Tests: `ErrPage.brm`, `errors.brm.ts`, a store-level test.
- `$untrack` importer test uses a memo and a signal now, and asserts "0|" then "1|xyz".
- Wrong-form errors: component messages, so component codes. One table test asserts code and text for 20 cases.
- Pending state under a symbol key, with `instanceof Set` check.
- Used `sed -i` for a few import line edits again; later edits used the Edit tool.

## Review round 2 (head a405591f)

- The maintainer ruled that `derived` of `brumate/store` keeps its main behavior. Holding moved to `heldDerived` (what a module memo compiles to), `gated` and `timed`. `derived.test.ts` and `context.md` are as on main. New tests: a user's derived throws into `set`, and a held store notifies once when it recovers.
- Duplicate notice on recovery: a forced send only when the run did not already notify (same value). Exact sequences are asserted for `plain`.
- `subscribeSlot` reads again only stores with the `Symbol.for('brumate.holds')` key.
- Changeset rewritten to match `reactive-modules.md`.
- Wording of BRM120 and BRM203 for modules not done: the pins in `test/error-codes.json` forbid changing a message of a code. Left for the maintainer.
- One `sed -i` for the import line of the test file.
