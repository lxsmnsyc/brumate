# Outcome: brm-skill

## Built

- The skill, in the Agent Skills format: `packages/brumate/skills/brumate/SKILL.md` (name, description, the rules that agents get wrong) and `references/` with `syntax.md`, `state.md`, `events.md`, `ui.md` and the generated `errors.md`.
- `npx brumate skill [folder]` (shared file `packages/brumate/src/cli.ts`) copies the skill into `folder/brumate`, by default `.claude/skills/brumate` of the current directory.
- `.claude/skills/brumate` in the repo is a symlink to the skill, so the agents of this repo use it.
- The error catalog, `packages/brumate/src/error-catalog.ts`: `ErrorEntry`, `ERRORS` (about 170 entries: syntax errors, errors of the script functions, errors of the code that the browser gets, errors of modules of reactive logic), and the helpers `findError(message)`, `matchesError(entry, message)` and `renderErrors()`.
- The test, `packages/brumate/test/skill.test.ts`:
  - every `brm` block of the skill compiles;
  - a block marked `` ```brm wrong="text" `` must fail with a message that holds the text, and the message must have an entry in the catalog;
  - a block marked `brm fragment` is skipped;
  - `references/errors.md` equals `renderErrors()`. `UPDATE_SKILL=1 npx vitest run test/skill.test.ts` writes it again;
  - an AST scan of `src/*.ts` finds the messages that the compiler can report, and fails when one has no entry;
  - `brumate skill` copies the files.
- The contract `docs/roadmaps/brumate/contracts/error-catalog.md` is `status: frozen`, version 1. The shape of `ErrorEntry` and `ERRORS` did not change from the proposal. The contract now also documents the three helpers and the rules of an entry.
- A changeset: `.changeset/brumate-skill.md` (minor).

## Deviations

- `packages/brumate/package.json`: `"skills"` added to `files`, so the skill ships in the package. It is outside the owned paths.
- Nothing else outside the owned paths, `cli.ts` (shared), the node's folder and the changeset.

## Stubs left

- None. `code` and `link` of an entry are unset: brumate-check assigns them. `renderErrors()` already prints them in the heading and below the cause.

## Gotchas

- A new compile error needs an entry in `ERRORS` in the same change, or `skill.test.ts` fails. The message form must be the same after each `{name}` or `${…}` is turned into `{}`. Run `UPDATE_SKILL=1 npx vitest run test/skill.test.ts` to write errors.md again.
- The scan reads `fail(...)`, `report('error', ...)`, `new ModuleError(...)`, `{ severity: 'error', message }` objects, the second argument of `expect(...)` and the third of `parseIdentifier(...)` in the parser, and tables named by a member expression such as `MISPLACED[name]`. A message that is built some other way is not seen. Add its entry by hand and widen the scan.
- Messages that pass on the text of another parser (script code, CSS) have no entry. Only `Invalid CSS: {message}` has one.
- `Unknown block #{keyword}` in the parser is unreachable, but it has an entry because the scan sees it.
- Code blocks in the skill compile as whole files with `compile()`. Imports of `.brm.ts` modules resolve from disk, so a block that calls a module function is marked `fragment`. Imports of `@brumate/ui/...` are not resolved by `compile`, so they compile.
- The sandbox hook of the worktree refuses commands that hold the text "git" anywhere, such as the path "GitHub" or the word "digit". Split such commands, or use the Write tool.
- Keep the skill in step with the docs. A change to syntax or to a rule in `website/docs` that the skill states needs the same change in `packages/brumate/skills/brumate`. The test catches a block that no longer compiles, not a rule that went stale.

## Proposed learnings

- A new compile error gets an entry in `src/error-catalog.ts` in the same change | the test fails otherwise, and errors.md is generated from it | packages/brumate | yes
- A code block in the skill marked `brm` must compile, and one that shows a mistake is marked `wrong="message"` | the examples that agents copy stay true to the compiler | packages/brumate/skills | yes

## Verification

- `npx vitest run test/skill.test.ts` in packages/brumate: 41 tests pass. The tests failed first on three blocks that were wrong (an attribute that compiles, an unknown block that is text, and errors.md missing). Removing one catalog entry makes the scan test fail.
- `npx oxlint`: no finding in the files of the node (the findings in other files are existing warnings).
- `npx oxfmt --check`: all files use the correct format.
- `npx tsc --noEmit -p .` in packages/brumate: no error in the files of the node. The errors that remain are in test fixtures that import `brumate/signals`, `brumate/server` and the like, because this worktree has no `dist` build.
- The full e2e suite was not run.

## Size

- Estimated M, actual M. The catalog of about 170 entries was most of the writing.
