# Outcome: skill-0-9-apis

## Built

- `packages/brumate/skills/brumate/references/state.md`: `$produce` on maps and sets, BRM209, "Async effects".
- `packages/brumate/skills/brumate/references/signals.md`: async callbacks and cleanup forms of `$effect` and `$client`, module-level `$signal`/`$memo`, `$produce` on maps and sets.
- `packages/brumate/skills/brumate/references/syntax.md`: `:where` scoping, inline component CSS with cached sheets, scripts in markup (`inline`, `src`, `trigger`, `data-rerun`), "Shared state at module level" (writes through exported functions, BRM211, BRM208).
- `packages/brumate/skills/brumate/references/events.md`: "View transitions" (`transition()`, `viewTransition`, `viewTransitionName`, `navigate: { transition: true }`).
- `packages/brumate/skills/brumate/SKILL.md`: rules for the above, and the reference routes.
- `.changeset/skill-0-9-apis.md`: patch for brumate.

## Deviations

- The head script example and rule now use `<script inline data-rerun>` instead of `raw()` with `getEvent().nonce`, since navigation.md changed to that form in external-scripts. The `head-script` task still asks for `raw()` and still passes. It was left as is.

## Stubs left

- None.

## Gotchas

- `run-tasks.mjs --reference` needs a project whose package.json lists `@brumate/ui` in its dependencies. Without it, the theme task fails with BRM167, because `brumate check` finds component packages from the dependencies.
- BRM209 is a warning, so the skill names it in prose. A `wrong:` block only tests errors.

## Proposed learnings

- The scratch project for run-tasks lists brumate and @brumate/ui as dependencies | `brumate check` resolves package modules from them | packages/brumate/skills | no

## Verification

- `node packages/brumate/skills/run-tasks.mjs --reference --project <scratch project>`: 6/6.
- `npx vitest run test/skill` in packages/brumate: 76 passed.
- `pnpm format:check` passes. `pnpm exec oxlint`: exit 0, warnings only in files outside this change.

## Size

- Estimated S, actual S.
