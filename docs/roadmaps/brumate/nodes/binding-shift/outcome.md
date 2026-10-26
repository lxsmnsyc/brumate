# Outcome: binding-shift

## Built

- `SCOPE_IDS.holders` in `packages/brumate/src/runtime/shared.ts`: the classes that keep references in their own fields. It holds `Binding`.
- `shiftState` in `packages/brumate/src/runtime/client-routes.ts` copies a holder with every own field moved through `shiftValue`. A `Binding` in `s`, `b`, `i` or `v` now moves its `ref` (SlotReference) and its `set` (often a FunctionReference). client-routes.ts still imports no code.
- Tests in `packages/brumate/test/scope-ids.test.ts`: "moves the IDs of a binding" (the repro of the brief) and a class scan. The scan parses shared.ts with oxc-parser and collects every class. Each must be in `references`, in `holders`, or in the test's `withoutIds` list (empty), and each listed name must be a class of the file. It checks names, not field types, so a field typed `unknown`, a constructor parameter, a class with no constructor or an earlier `{ ... }` type cannot hide a class. Mutations that failed the test, then reverted: a class with an `unknown` field, one with `constructor(readonly r: SlotReference) {}`, an empty class, one with an earlier `{ x: number }` field.
- End-to-end tests in resume.test.ts: a parent binds `open` to a child with `const { ...rest } = $props()`, which renders `BindChild {...rest}` in an `#if` after a click. After navigation with `b-offset="5"`, a click on `.show` then on `.child.later` makes `.parent` read `open`, with a plain `$bind(open)` and with a setter. Fixtures `BindLate.brm`, `bindLateParent.brm`, `bindLateSetter.brm`. Both failed on main with "expected 'closed' to be 'open'".
- Changeset `.changeset/binding-shift.md`.

## Deviations

- None.

## Stubs left

- None.

## Gotchas

- A new class in shared.ts fails the scan until a person puts it in `references`, `holders` or `withoutIds`. The test does not check that the choice is right.
- A holder's other fields also pass through `shiftValue`, so `Binding.value` is walked too.

## Proposed learnings

- A class that holds a reference goes in `SCOPE_IDS.holders` | the scan test fails for one that is missing | packages/brumate/src/runtime | yes (scope-ids.test.ts)

## Verification

- Both new tests failed on main, and pass now.
- `npx vitest run` in packages/brumate: 55 files pass, 957 tests pass, 5 expected fail. `npx oxfmt --check`: pass. `npx oxlint`: warnings only, none in the changed files. `npx tsc --noEmit -p .`: no errors outside the `brumate/*` self-imports of test fixtures. packages/ui not changed, its suite not run.

## Size

- Gzip unminified, `npx tsdown`, base to head: produce (eager) 3863 to 3934 (+71 B), client 30903 to 30909 (+6 B), client-routes (lazy) 1793 to 1818. Eager total +77 B, within 0.1 kB. Minified not measured (esbuild not linked). `pnpm bench` not run.
- Estimated S, actual S.
