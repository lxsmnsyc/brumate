# Log: skill-blocks-typecheck

- Read the ui skill test (`packages/ui/test/skill.test.ts`) and copied its shape into `packages/brumate/test/skill.test.ts`.
- Each whole-file `brm` block is written to `test/.output/skill/<file>-<line>/Page.brm`, with the `ts module="name"` blocks of its page beside it. `test/.output/` is already in `.gitignore`.
- One `brumate-tsc --noEmit -p` run covers all blocks. Errors map back to a block by its folder name.
- A crash of the checker prints no `error TS` line, so the test rethrows it. Without that, every block would pass.
- `@brumate/ui/` imports become `../../../../../ui/src/`. Brumate gets no new dependency.
- The bins need `dist` in a fresh worktree: `pnpm --filter brumate build`, `@brumate/tsc` and `@brumate/language-core`. The root typecheck also needs `@brumate/language-server`.
- First run found 4 failing blocks, listed in outcome.md. Fixed in the skill text.
- Added a `type-error: TS2322` block to `references/state.md` (a string written to a number signal).
