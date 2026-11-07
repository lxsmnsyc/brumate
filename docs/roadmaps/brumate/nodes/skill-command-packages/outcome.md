# Outcome: skill-command-packages

## Built

- `packages/brumate/src/cli.ts`: `brumate skill [folder]` also copies each skill folder in `skills/` of every `@brumate/*` package found in `node_modules`, from the current directory up (nearest wins). `@brumate/ui` gives `<folder>/brumate-ui`. The usage text says so.
- `packages/brumate/test/skill.test.ts`: runs the CLI in a temp project with a fake `@brumate/ui` skill and a package without skills. Checks the copied files and the folder list.
- `website/ui/introduction.md`: says `npx brumate skill` instead of the `cp` command.
- Changeset `.changeset/skill-command-packages.md` (minor, brumate).

## Deviations

- None. The command takes no new flag.

## Stubs left

- None.

## Gotchas

- Packages are found from the current directory, not from the target folder.
- Only folders under a package's `skills/` are copied; loose files are ignored.
- The existing copy test runs in packages/brumate, so it may also copy workspace skills there. It checks only the brumate files.

## Proposed learnings

- None.

## Verification

- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm --filter brumate exec vitest run test/skill.test.ts`: 56 passed.

## Size

- Estimated S, actual S.
