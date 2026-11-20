# Outcome: skill-blocks-typecheck

## Built

- `packages/brumate/test/skill.test.ts`: one `brumate-tsc` run over every whole-file `brm` block of the skill. A block marked `type-error: TSxxxx` must fail with that code. The test rethrows a crash of the checker.
- `packages/brumate/skills/brumate/references/state.md`: a `type-error: TS2322` block, and `ts module` blocks for `chat.ts` and `theme.ts`.

## Skill blocks fixed

- `references/events.md` (remove button): `type: 'button'` is now `'button' as const`, so the spread fits the button props.
- `references/state.md` (async effect): `./chat.ts` had no module block. Added one.
- `references/state.md` (context): `./theme.ts` had no module block. Added one, and the prose now points to it.
- `references/syntax.md` (control flow): `reset` in `#catch (error, reset)` was unused. The block now has a Retry button that calls it.

## Deviations

- Added `.changeset/skill-blocks-typecheck.md` (patch, brumate), as the skill text ships in the npm package.

## Stubs left

- None.

## Gotchas

- A fresh worktree needs `dist` of `brumate`, `@brumate/tsc` and `@brumate/language-core` before the test runs.
- A module block of the skill must pass the repo's strict config too (`isolatedDeclarations`, `noUnusedParameters`), as users copy it.

## Proposed nodes

- None. No `brumate-tsc` bug found.

## Verification

- `pnpm --filter brumate exec vitest run test/skill.test.ts`: 101 passed.
- `pnpm lint`: no errors. `pnpm format:check`: clean. `pnpm typecheck`: clean.

## Size

- Estimated S, actual S.
