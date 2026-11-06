# Outcome: context-read-fallback

## Built

- `$getContext(C, fallback)`: the provided value, or the fallback without a provider, in one walk (`consume(C, scope, fallback)` on the server and in the browser). The argument count decides, so `$getContext(C, undefined)` is the optional read. A literal fallback is passed as it is; other code compiles to a function that runs only without a provider. `has()` and `hasContext()` are deleted.
- `$hasContext` is removed: calling it is BRM197 with the new form in the message.
- `$store` takes a store only. `$store(Ctx)` (when the file names Ctx), `$store(g?.key)`, `$store(undefined)` and `$store(null)` are compile errors (BRM199, BRM197). A non-store at run time throws a `TypeError` naming `$store`. Type: `$store<T>(source: StoreLike<T>): T`.
- Optional stores: the guard on the value, `const g = $getContext(C, undefined); const s = g ? $store(g.key) : undefined;`, and a store as the fallback, `$store($getContext(C, store(x)))`. The fallback form records the context key with a provider and the `z` link of the fallback without one, so the browser links the provider's store or runs the fallback once.
- packages/ui: 86 files rewritten by script. `$hasContext` in `src` went from 228 to 0, `$getContext` from 133 to 228, `$store(` from 129 to 130. 27 locale readers use `$store($getContext(LocaleContext, store(DEFAULT_LOCALE)))` and keep `?? DEFAULT_LOCALE` for a provided `null`.
- The resume repair in `subscribeSlot` compares arrays and plain objects by content (`sameData`). A fallback store made again in the browser no longer rewrites its readers.
- Docs: context.md, reference-signals.md, skill references, error pages, ui README, decisions.md (`$store` entry and the context-no-defaults entry), and the story's unreleased changesets.

## Deviations

- The brief said to split the ui rewrite past 60 files. It stayed in this node: the core turns the old ui forms into compile errors, so the two can only land together.
- Part 1 of store-repair-compare (structural compare for the repair) is done here. Without it the locale fallback broke 14 color tests: the repair rewrote the locale slot at resume and reset the sliders.
- `$store(Ctx)` for an imported context the file does not name in `$getContext`/`$setContext` is a run-time `TypeError` and a brumate-tsc type error, not a compile error.
- check.ts lost `guardedKeys`, which typed the old guarded form with `!`; the new guard narrows the type itself.

## Measured

- examples/ui client JS gzip: 202983 -> 202812 B (-171).
- Checks: oxlint, oxfmt --check, typecheck, all 11 package and example test scripts (brumate 2846, ui 777), `node e2e/run.mjs --only ui --no-build` 55/55.

## Gotchas

- `$route()`/`$navigation()` compile to `consume(C, scope, undefined, slot)`. The runtime takes a fallback only with exactly one argument after the scope; any other count throws without a provider.
- ui `preview.test.ts` failed once under the full parallel run and passed twice alone.

## Follow-ups (review nits, not done)

- `sameData` has no cycle guard and compares the whole value on each resumed store read.
- `flag ? $store(a) : undefined` on a plain flag reports BRM197 about `$getContext(C, undefined)`, which reads oddly.
