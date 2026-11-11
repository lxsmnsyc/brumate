# Outcome: skill-tasks

## Built

- `packages/brumate/skills/run-tasks.mjs`: `node packages/brumate/skills/run-tasks.mjs [task ...] [--project dir] [--answers dir] [--reference] [--json]`. For each task it reports `compile` (`brumate check --no-types --json`), `types` (`brumate check --json`) and `test` (Vitest, brumate plugin, happy-dom). The answer of a task is `<answers>/<task>/src` (default `<project>/.tasks/answers`). `--reference` grades the solutions. It exits 1 when a task fails. It calls no model.
- `packages/brumate/skills/tasks/<id>/` with `task.md` (the prompt), `test.ts` and `solution/src` for six tasks: `counter`, `todos` (keyed list, block `<style>` with `${}`), `plan-form` (server function, Select of @brumate/ui), `cart` (`derived` of brumate/store), `theme` (ColorScheme, `colorScheme()`), `head-script` (`getEvent().nonce`, `data-rerun`).
- The project that is graded must have brumate, @brumate/ui, @brumate/tsc, vitest, happy-dom and vite, with brumate and @brumate/ui listed in its package.json.

## Deviations

- `packages/brumate/package.json` (outside the owned paths): `files` gets `!skills/tasks` and `!skills/run-tasks.mjs`, so the tasks do not ship. No changeset, since nothing user-visible changes.
- Six tasks instead of four, to cover the 0.8 APIs.

## Stubs left

- None.

## Gotchas

- The self-test needs a project whose package.json lists `brumate` and `@brumate/ui`. `packages/ui` does not work as the project (not its own dependency). The log has the scratch project that was used.
- A server function in a task test needs `answerCalls()`.
- No agent run was done: grading an agent's output is for the maintainer before a release.

## Skill gaps (for the orchestrator)

- SKILL.md and references do not mention `derived` of `brumate/store`, `getEvent().nonce`, `<script data-rerun>`, or `@brumate/ui` (Select, ColorScheme, `colorScheme()`). A node that owns the skill should add them; the `cart`, `head-script`, `theme` and `plan-form` tasks will show whether an agent finds them from the docs alone.

## Proposed learnings

- A Vitest project that uses packages of components must list them in package.json | the plugin finds them from there | packages/brumate/skills | no

## Verification

- `node packages/brumate/skills/run-tasks.mjs --reference --project <scratch>`: 6/6 tasks pass (compile, types, test).
- A wrong counter (`count.value++`) fails types and test.
- `pnpm exec oxlint`: no warning in the new files. `pnpm format:check`: passes. `vitest run test/skill.test.ts` in packages/brumate: 57 passed. `npm pack --dry-run` lists only `skills/brumate`.
- `pnpm typecheck` was not run: `skills/` is outside every tsconfig `include`.

## Size

- Estimated S, actual S.
