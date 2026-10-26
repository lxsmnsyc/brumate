# Outcome: scope-id-table

## Built

- `SCOPE_IDS` in `packages/brumate/src/runtime/shared.ts`: one table with `fields` (`Record<keyof ScopeState, FieldKind>`, kinds `none | id | ids | value | values | map`) and `references` (a list of `[class, shift]` for ElementReference, FunctionReference, ChildrenReference, SlotReference). A new field of `ScopeState` fails to compile until it is in `fields`.
- `shiftState(ids, state, by)` in `client-routes.ts` is exported and reads the table, which client.ts passes as `scopeIds` through the core (it replaces the four reference-class re-exports). client-routes.ts still imports no code.
- `packages/brumate/test/scope-ids.test.ts`: the fields of the table equal the keys of a full record; the reference classes of the table equal the classes of shared.ts with a `readonly scope: ScopeId`; a full record moves every ID.
- Changeset `.changeset/scope-id-table.md`.

## Deviations

- None. `shiftState` is now exported from client-routes.ts, for the test.

## Stubs left

- None.

## Gotchas

- `Binding` (its `ref` SlotReference and `set`) is not in the table, as it was not moved before. A Binding inside a record moved by `b-offset` keeps its old slot scope. Possible bug, not confirmed.
- The class check of the test reads shared.ts for `readonly scope: ScopeId`. A class that names the field otherwise is missed.
- Other walkers do not need the table: `parseId` reads text, the plugins of serial.ts write IDs without moving them, devtools.ts only shows them.

## Proposed learnings

- A walker of scope IDs reads `SCOPE_IDS`, never a hand-written list of fields | three bugs came from a missed field | packages/brumate/src/runtime | yes (scope-ids.test.ts)

## Verification

- `npx vitest run test/scope-ids.test.ts`: 3 pass. Setting `c` to `none` in the table makes the move test fail. Removing `b` fails `tsc`.
- navigate, shared and resume tests pass.
- `npx oxlint`: no new findings. `npx oxfmt --check`: pass. `npx tsc --noEmit -p .`: no errors in src or the new test (the remaining errors are missing `brumate/*` self-imports of test fixtures, which need the ui link setup).
- Size: the unminified dist gzip of client plus client-routes went from 32569 to 32497 bytes (-72). `pnpm bench` not run.

## Size

- Estimated S, actual S.
