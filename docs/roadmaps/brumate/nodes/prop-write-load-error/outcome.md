# Outcome: prop-write-load-error

## Built

- `prop` in packages/brumate/src/runtime/client/props.ts passes a rejected module load to `fail(child, error)` (client/errors.ts), so the nearest `#try` renders its `#catch`.
- Test in packages/brumate/test/resume.test.ts (`a prop write to a child whose code fails to load`) with the fixtures `propLoadFail.brm` and `PropLoadKid.brm`. It fails on main (the `#catch` never renders) and passes with the fix.
- Patch changeset.

## Deviations

None.

## Stubs left

None.

## Gotchas

- The child's load starts at resume, and `loadComponent` swallows its rejection. Only a write that waits on the load (`prop`) saw it, so the test holds the load with a gate past the click.
- A `#try` whose body cannot throw may get no `t` table in the compiled module. The fixture has a handler and a `reset` in the `#catch`, like handlerWaitFail.

## Proposed learnings

None.

## Verification

- `pnpm lint` passes (warnings only). `pnpm format:check` reports only docs/roadmaps/brumate/nodes/website-script-names/outcome.md, a file from main that this node does not touch. `pnpm --filter brumate typecheck` passes; root `pnpm typecheck` fails in examples/* on the missing packages/tsc build, as on a fresh worktree.
- `npx vitest run` in packages/brumate: 64 files, 1304 tests pass.

## Size

`pnpm bench` not run (exclusive). The change adds one import and one rejection handler to props.ts, about 30 bytes of source.
