# Outcome: skill-0-8-apis

## Built

- `packages/brumate/skills/brumate/references/state.md`: Derived stores (`derived`, `$store`).
- `packages/brumate/skills/brumate/references/syntax.md`: head script with `getEvent().nonce` and `data-rerun`; `ColorScheme` and `colorScheme()`.
- `packages/brumate/skills/brumate/SKILL.md`: rules for the three, and the reference routes.
- `.changeset/skill-0-8-apis.md`: patch for brumate, since the skill ships.

## Deviations

- `packages/brumate/test/skill.test.ts` (outside the owned paths): resolves `@brumate/ui/*.brm.ts` from packages/ui/src, so the `colorScheme()` example compiles.

## Stubs left

- None.

## Gotchas

- Block styles were already covered; nothing added for them.

## Verification

- `node packages/brumate/skills/run-tasks.mjs --reference` with a scratch project: 6/6.
- `vitest run test/skill.test.ts`: 65 passed.
- `pnpm format:check` passes. `pnpm exec oxlint`: only warnings in files outside this change.

## Size

- Estimated S, actual S.
