# Outcome: client-markup-docs

PR #455 against next. Acceptance met: test shows the callback runs after the markup is in the page; the section is in effects.md and the samples compile (66 samples, 0 problems).

## Findings

- For a component that an `#if` opens, `$client` (idle) runs after its markup is in the page, in markup order. Closing runs the cleanups in markup order; reopening renders new components and runs the callbacks again. The page callback does not rerun.

## Deviations

- Added two fixtures: packages/brumate/test/render/clientOrder.brm and ClientOrderPart.brm (under shared packages/brumate/test/**).
- Root `pnpm typecheck` fails in packages/vscode in the worktree (language-server not built); brumate typecheck passes.
