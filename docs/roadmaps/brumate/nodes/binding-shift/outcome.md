# Outcome: binding-shift

## Built

- `SCOPE_IDS.holders` in `packages/brumate/src/runtime/shared.ts`: the classes that keep references in their own fields. It holds `Binding`.
- `shiftState` in `packages/brumate/src/runtime/client-routes.ts` copies a holder with every own field moved through `shiftValue`. A `Binding` in `s`, `b`, `i` or `v` now moves its `ref` (SlotReference) and its `set` (often a FunctionReference). client-routes.ts still imports no code.
- Tests in `packages/brumate/test/scope-ids.test.ts`: "moves the IDs of a binding" (the repro of the brief) and "names every class that holds a reference with an ID". The scan reads shared.ts for exported classes with a field typed as a reference class of the table, and compares them with `holders`.
- Changeset `.changeset/binding-shift.md`.

## Deviations

- None.

## Stubs left

- None.

## Gotchas

- The holder scan matches the names of the table's reference classes in the fields before the constructor. A class that holds IDs only through an `unknown` field (as `Binding.set` is) is found only if it has another field of a reference class.
- A holder's other fields also pass through `shiftValue`, so `Binding.value` is walked too.

## Proposed learnings

- A class that holds a reference goes in `SCOPE_IDS.holders` | the scan test fails for one that is missing | packages/brumate/src/runtime | yes (scope-ids.test.ts)

## Verification

- Both new tests failed on main, and pass now.
- `npx vitest run` in packages/brumate: 55 files pass, 957 tests pass, 5 expected fail. `npx oxfmt --check`: pass. `npx oxlint`: warnings only, none in the changed files. `npx tsc --noEmit -p .`: no errors outside the `brumate/*` self-imports of test fixtures. packages/ui not changed, its suite not run.

## Size

- Gzip unminified, `npx tsdown`, base to head: produce (eager) 3863 to 3934 (+71 B), client 30903 to 30909 (+6 B), client-routes (lazy) 1793 to 1818. Eager total +77 B, within 0.1 kB. Minified not measured (esbuild not linked). `pnpm bench` not run.
- Estimated S, actual S.
