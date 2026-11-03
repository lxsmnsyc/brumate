# Outcome: drop-colon-modifiers

## Built

- `onSubmit:prevent=save` (any `on...:x`) is a parse error BRM022 on elements, `<window>`, `<document>` and components: `Event modifiers in the attribute name were removed. Write onSubmit=(prevent(handler)) with prevent from brumate/events`; for a chain it nests every wrapper (`onSubmit=(prevent(stop(handler)))`); a name that brumate/events does not export (`:self`, `:later`) is said not to be a modifier; for `:passive`, `Write onClick=(handler), since listeners are passive unless a handler prevents`. packages/brumate/src/parser.ts.
- Removed `Modifier`, `EventAttribute.modifiers` (ast.ts), `printModifiers` (print.ts), the warning of `readWrappers` (analyze.ts), BRM023 (error-catalog.ts).
- Uses converted: 3, the `<form onSubmit:prevent=add>` of packages/brumate/test/{render,fixtures,vite-app}/todos.brm (now `onSubmit=(prevent(add))` with the import). One more in the wrong-block of packages/ui/skills/brumate-ui/SKILL.md (new message). No other use in packages, website, examples, samples or the skill.
- VS Code grammar no longer scopes `:modifier`; grammar.test.ts updated.
- Docs: docs/grammar.md, docs/decisions.md, website/docs/markup.md, reference-blocks.md, errors.md (regenerated), skill references/errors.md (regenerated).
- Changesets: brumate minor, brumate-vscode patch.

## Deviations

- Edited files outside the shared list: packages/brumate/src/codegen/client.ts and markup.ts (they read `attribute.modifiers`), packages/brumate/test/error-codes.json (pinned message of BRM022), packages/brumate/test/**snapshots**/{inspect,render,}todos snapshots, .changeset/drop-colon-modifiers-vscode.md.
- No new error code; BRM022 reworded, BRM023 deleted.

## Stubs left

- None.

## Gotchas

- Code that writes the modifier by wrapper keeps the wrapper call in the client bundle (`prevent(add$.bind(...))`), so a handler entry in todos grows by about 100 B.
- `git stash` is shared between worktrees; do not use it in a worker.

## Proposed learnings

- Do not use `git stash` in a worktree | the stash list is shared by every worktree of the repo | repo | no

## Verification

- `pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm build`, brumate suite (2769), ui (772), vscode, tsc, language-server, examples: pass when run with fewer workers. The first parallel `pnpm test` showed load flakes (resume, devtools, differential) that passed alone.
- `pnpm --filter website check:samples`: 65 samples, 0 problems.

## Size

- Estimated S, actual S.
