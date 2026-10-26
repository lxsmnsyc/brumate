# Outcome: scope-id-table

## Built

- `SCOPE_IDS` in `packages/brumate/src/runtime/shared.ts`: one small table with `fields` (`Record<keyof ScopeState, FieldKind>`, kinds `none | id | ids | value | values | map`) and `references` (the classes ElementReference, FunctionReference, ChildrenReference and SlotReference, which keep their ID in `scope`). The eager chunk holds only names and kinds. `shiftState` in the lazy client-routes.ts shifts, with its own `shiftId`, and copies a reference with its own fields and a moved `scope`. A new field of `ScopeState` fails to compile until it is in `fields`.
- `shiftState(ids, state, by)` in `client-routes.ts` is exported and reads the table, which client.ts passes as `scopeIds` through the core (it replaces the four reference-class re-exports). client-routes.ts still imports no code.
- `packages/brumate/test/scope-ids.test.ts`: the fields of the table equal the keys of a full record; the reference classes of the table equal the classes of shared.ts with a `readonly scope: ScopeId`; a full record moves every ID.
- Changeset `.changeset/scope-id-table.md`.

## Deviations

- None. `shiftState` is now exported from client-routes.ts, for the test.

## Stubs left

- None.

## Gotchas

- The table does not cover `Binding`, which a later PR fixes from main. `Binding` (its `ref` SlotReference and `set`) is not in the table, as it was not moved before. A Binding inside a record moved by `b-offset` keeps its old slot scope. Possible bug, not confirmed.
- The class check of the test reads shared.ts for `readonly scope: ScopeId`. A class that names the field otherwise is missed.
- Other walkers do not need the table: `parseId` reads text, the plugins of serial.ts write IDs without moving them, devtools.ts only shows them.

## Proposed learnings

- A walker of scope IDs reads `SCOPE_IDS`, never a hand-written list of fields | three bugs came from a missed field | packages/brumate/src/runtime | yes (scope-ids.test.ts)

## Verification

- `npx vitest run test/scope-ids.test.ts`: 3 pass. Setting `c` to `none` in the table makes the move test fail. Removing `b` fails `tsc`.
- navigate, shared and resume tests pass.
- `npx oxlint`: no new findings. `npx oxfmt --check`: pass. `npx tsc --noEmit -p .`: no errors in src or the new test (the remaining errors are missing `brumate/*` self-imports of test fixtures, which need the ui link setup).
- Size by chunk, base to head, gzip unminified / minified (esbuild), `npx tsdown`: produce (shared, eager) 3602 to 3863 / 1652 to 1730 (+261 / +78); client 30783 to 30781 / 15409 to 15412; client-routes (lazy) 1786 to 1793 / 1002 to 957. The first version put `shiftId` and per-class shifts in the eager chunk (+447 unminified); this one moved them back to the lazy chunk. `pnpm bench` not run.

## Size

- Estimated S, actual S.
