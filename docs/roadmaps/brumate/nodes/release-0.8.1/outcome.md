# Outcome: release-0.8.1

## Release

Released 2026-11-19. The 0.8.1 batch was pushed to main as 078262b1 (head-nonce-keep, children-rerender, template-context, resume-test-races, ref-element-writes, pending-read; resolve-gone-child fulfilled by pending-read). The maintainer merged Version Packages #527 (1b499c93); Release passed. brumate 0.8.1, @brumate/language-core 0.3.1, and language-server, tsc and typescript-plugin 0.1.19 are on npm.

## Deviations

- The batch cut went to main as a direct push, not the PR the orchestrator had announced. Rule recorded: cuts into main go as a PR.
- template-context was reverted once on the batch (it broke the @brumate/ui DateField tests) and reworked before the cut.

## Open

- `main` is merged into `release/0.9` locally on the batch worktree (../brumate-batch, branch batch/brumate-release-0.9, which also carries skill-0-9-apis 66b78312). Conflicts: 16 outcome files (main kept) and two code spots: `updates.ts` (PromiseLike from main) and `navigate.ts` (unconditional `headHTML`, `identity` kept). Push it to release/0.9 after the full check passes.
