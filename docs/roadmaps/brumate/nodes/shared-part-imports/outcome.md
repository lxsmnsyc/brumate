# Outcome: shared-part-imports

## Built

- `importsFor` in `packages/brumate/src/codegen/client.ts` skips the imports of `<script module>` only for the shared part that copies them. Other parts, and a shared part that does not copy them, import the names their code uses.
- `importsFor` also reads the components in templates that children of the update part call or pass on (`cell=day`).
- Tests: `packages/brumate/test/shared-part-imports.test.ts`, `packages/ui/test/client-part-imports.test.ts` (compiles every `.brm` of packages/ui/src and test/fixtures).
- Changeset: `.changeset/shared-part-imports.md` (patch).

## Deviations

- The brief named the shared part only. The all-component test found the same kind of gap in the update part (templates passed as props), fixed in the same function.

## Stubs left

- None.

## Gotchas

- The name check in the ui test is textual (no scope analysis): it ignores names declared in the part, strings, comments and property keys.

## Proposed learnings

- A part of the client output imports every name its code reads | the imports differ per part | packages/brumate/src/codegen | yes (packages/ui/test/client-part-imports.test.ts)

## Verification

- Codegen test fails on main, passes with the fix. The ui test lists 10 gaps on main and none with the fix.
- @brumate/ui suite (clean, `--maxWorkers 2 --testTimeout 30000`): 770 passed, 1 expected fail. `pnpm --filter brumate test`: 1265 passed.
- `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck` pass.
- `node e2e/run.mjs --only website`: 72 passed. `--only ui`: 55 passed.

## Size

- Estimated S, actual S.
