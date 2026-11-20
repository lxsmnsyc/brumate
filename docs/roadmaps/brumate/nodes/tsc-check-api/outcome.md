# Outcome: tsc-check-api

## Built

- `checkProject(root, { project? })` in `packages/tsc/src/check.ts`, exported from `@brumate/tsc`. It returns `TscDiagnostic[]`: `file` (relative, null for a project problem), `range` (`start` and `end`, 1-based, null without a place), `severity`, `message` and `code` (`TS2322`, or `BRM031` for a syntax error of a `.brm` file). It does not print and does not end the process.
- It uses the TypeScript 6 API (`typescript-api`) and `proxyCreateProgram` of `@volar/typescript` with the brumate language plugin. It reads the tsconfig file with `.brm` as an extra file extension, sets `allowNonTsExtensions` so root `.brm` files are accepted, and sorts the diagnostics like `tsc`.
- `brumate check` loads `@brumate/tsc` from the project with `createRequire(root/noop.js).resolve('@brumate/tsc')` and `import()`. brumate gains no dependency. Without the package or a tsconfig.json it skips with a note, as before. A throw while loading or running is one error record, "The type check did not finish: ...".
- The spawn, `parseTypeOutput` and the buffer and signal handling are gone. `CheckOptions.tscBin` became `tscModule`, the module that exports `checkProject`, for the tests.
- `brumate check --json` keeps its shape. TypeScript records now have a real end position, not the start.
- `run()` and `brumate-tsc` are unchanged.
- Changesets: `.changeset/tsc-check-project.md` (`@brumate/tsc` minor), `.changeset/check-types-in-process.md` (`brumate` patch).

## Deviations

- `website/docs/typescript.md` and the help text in `cli.ts` now say the check runs in process.
- Related information lines that `tsc` prints under a message are not included.

## Follow-ups

- None.

## Gotchas

- The fixture of `packages/tsc` needs `brumate` and `@brumate/language-core` built before `checkProject` runs.
- A full `pnpm typecheck` in a fresh worktree needs the packages built, and runs out of memory in parallel. Use `--workspace-concurrency=1`.

## Verification

- See log.md.
- Root `pnpm test` had load-dependent failures in render and differential tests of brumate, different in each run. Run alone, `packages/brumate` passes.
