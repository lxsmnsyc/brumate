# Outcome: brm-skill

## Built

- The skill, in the Agent Skills format: `packages/brumate/skills/brumate/SKILL.md` (name, description, the rules that agents get wrong) and `references/` with `syntax.md`, `state.md`, `signals.md` (every function of `brumate/signals`, one line each), `events.md` and the generated `errors.md`.
- `npx brumate skill [folder]` (shared file `packages/brumate/src/cli.ts`) copies the skill into `folder/brumate`, by default `.claude/skills/brumate` of the current directory.
- `.claude/skills/brumate` in the repo is a symlink to the skill, so the agents of this repo use it.
- The error catalog, `packages/brumate/src/error-catalog.ts`: `ErrorEntry`, `ERRORS` (about 180 entries: syntax errors, errors of the script functions, errors of the code that the browser gets, errors of modules of reactive logic), and the helpers `findError(message)`, `matchesError(entry, message)` and `renderErrors()`.
- The test, `packages/brumate/test/skill.test.ts`:
  - every `brm` block of the skill compiles, and none reads `.value` of a signal or memo that it declares (the compiler accepts `count.value++`, so the test looks for it). The blocks are not typechecked with brumate-tsc: that needs built `dist` of brumate and tsc, which a test cannot rely on;
  - a block marked `brm uses` calls a module of reactive logic. The ```ts module="name" block of the same page is its module;
  - a block marked ` ```brm wrong: <message>` must fail with exactly that first error message, and `findError` must give it an entry. `findError` picks the entry with the most fixed text, and a test checks that each entry is found by its own message, so no general entry hides a specific one;
  - the pieces of code in errors.md (`brm fragment`) are not compiled: they are parts of a file, such as one line of a script. They are generated from the catalog, so a test of the catalog covers them;
  - `references/errors.md` equals `renderErrors()`. `UPDATE_SKILL=1 npx vitest run test/skill.test.ts` writes it again;
  - an AST scan of `src/**/*.ts` (not `vite.ts` and `runtime/`, which report build and runtime errors) finds the messages that the compiler can report, and fails when one has no entry;
  - `brumate skill` copies the files, and rejects a second argument.
- The contract `docs/roadmaps/brumate/contracts/error-catalog.md` is `status: frozen`, version 1. The shape of `ErrorEntry` and `ERRORS` did not change from the proposal. The contract now also documents the three helpers and the rules of an entry.
- A changeset: `.changeset/brumate-skill.md` (minor).

## Deviations

- `packages/brumate/package.json`: `"skills"` added to `files`, so the skill ships in the package. It is outside the owned paths.
- Nothing else outside the owned paths, `cli.ts` (shared), the node's folder and the changeset.

## Stubs left

- None. `code` and `link` of an entry are unset: brumate-check assigns them. `renderErrors()` already prints them in the heading and below the cause.

## Gotchas

- A new compile error needs an entry in `ERRORS` in the same change, or `skill.test.ts` fails. The message form must be the same after each `{name}` or `${…}` is turned into `{}`. Run `UPDATE_SKILL=1 npx vitest run test/skill.test.ts` to write errors.md again.
- The scan reads `fail(...)`, `this.error(...)` of the code generator, `report('error', ...)`, `new ModuleError(...)`, `{ severity: 'error', message }` objects, the second argument of `expect(...)` and the third of `parseIdentifier(...)` in the parser, and tables named by a member expression such as `MISPLACED[name]`. A message that is built some other way is not seen. Add its entry by hand and widen the scan.
- Messages that pass on the text of another parser (script code, CSS) have no entry. Only `Invalid CSS: {message}` has one.
- `Unknown block #{keyword}` in the parser and `A dynamic tag that changes on the client is not supported yet` in the code generator are unreachable today (the parser keys every dynamic tag), but they have entries because the scan sees them.
- Code blocks in the skill compile as whole files with `compile()`. Imports of `.brm.ts` modules resolve from disk, so a block that calls a module function is marked `fragment`.
- The sandbox hook of the worktree refuses commands that hold the text "git" anywhere, such as the path "GitHub" or the word "digit". Split such commands, or use the Write tool.
- Keep the skill in step with the docs. A change to syntax or to a rule in `website/docs` that the skill states needs the same change in `packages/brumate/skills/brumate`. The test catches a block that no longer compiles, not a rule that went stale.

## Proposed learnings

- A new compile error gets an entry in `src/error-catalog.ts` in the same change | the test fails otherwise, and errors.md is generated from it | packages/brumate | yes
- A code block in the skill marked `brm` must compile, and one that shows a mistake is marked `wrong="message"` | the examples that agents copy stay true to the compiler | packages/brumate/skills | yes

## Verification

- `npx vitest run test/skill.test.ts` in packages/brumate: 65 tests pass. The tests failed first on three blocks that were wrong (an attribute that compiles, an unknown block that is text, and errors.md missing).
- Mutations: removing one catalog entry fails the scan test. Renaming a message in `codegen/client.ts` ("yet" to "now") fails it too, and the scan names the message. Writing `count.value++` in a right block fails the `.value` test.
- `npx oxlint`: no finding in the files of the node (the findings in other files are existing warnings).
- `npx oxfmt --check`: all files use the correct format.
- `npx tsc --noEmit -p .` in packages/brumate: no error in the files of the node. The errors that remain are in test fixtures that import `brumate/signals`, `brumate/server` and the like, because this worktree has no `dist` build.
- The full e2e suite was not run.

Review of #250: the scan first read only the top level of `src` and did not see `this.error(...)`, so six errors of `codegen/` had no entry. Added.

## Size

- Estimated M, actual M. The catalog of about 170 entries was most of the writing.

## Scope

- The skill does not document `@brumate/ui`. A skill for that package ships with it later, so `references/ui.md` was removed.
