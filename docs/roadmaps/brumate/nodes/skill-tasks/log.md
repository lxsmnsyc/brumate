# Log: skill-tasks

- Not built before: no `skills/tasks` or `run-tasks.mjs` on the batch.
- Tasks: counter, todos (keyed list and a block `<style>` with `${}`), plan-form (server function and a Select of @brumate/ui), cart (`derived` from brumate/store), theme (ColorScheme and `colorScheme()`), head-script (`getEvent().nonce` and `data-rerun`). Each has `task.md` (the prompt), `test.ts` and `solution/src`.
- Grader: three checks per task: `brumate check --no-types --json`, `brumate check --json` (types), and the test under Vitest with the brumate plugin and happy-dom. It copies the answer to `<project>/.tasks/run/<task>` and removes it after.
- The project must list `brumate` and `@brumate/ui` in package.json (dependencies or devDependencies). A symlinked project without them gave BRM167 for `@brumate/ui/color-scheme.brm.ts` and "Unknown component Select" at run time: packages of components are found from package.json only.
- `packages/ui` could not host the self-test: it is not a dependency of itself, so the same BRM167 appeared. The reference run used a scratch project with symlinks into node_modules (brumate, @brumate/ui, @brumate/tsc, vitest, happy-dom, vite, typescript) and a package.json that lists them.
- A server function of a `.brm` file in a test needs `answerCalls()` in `beforeEach`; without it the call goes to `fetch` and the result stays empty. The task test has it.
- A `</script>` cannot be written inside the `<script>` block; the head-script solution builds the tag in markup with `raw()`, as navigation.md does.
- The tasks would have shipped in the npm package since `skills` is in `files`. Added `!skills/tasks` and `!skills/run-tasks.mjs` (verified with `npm pack --dry-run`). No changeset: nothing user-visible changes.
- Negative run: a counter with `count.value++` fails types and test, and the grader exits 1.

## Skill gaps found

The skill (SKILL.md and references) says nothing of: `derived` of `brumate/store`, `getEvent().nonce`, `<script data-rerun>` in the head, `@brumate/ui` (Select, ColorScheme, `colorScheme()`). Only block styles are covered. Not fixed here: the skill is outside this node's paths.
