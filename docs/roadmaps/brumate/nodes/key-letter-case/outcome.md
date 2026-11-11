# Outcome: key-letter-case

## Built

- `keyMatches` in `packages/brumate/src/runtime/boot.ts` compares a single letter after a modifier in lower case, so `'Mod+K'` matches Cmd+K, Ctrl+K and with Shift too. Doc comments in `runtime/events.ts`, a line in `website/docs/markup.md`, patch changeset `.changeset/key-letter-case.md`.
- Rule for a letter without a modifier: exact case (`'Z'` matches `Z` only). Reason: `a` and `A` are different text input, and the docs match `event.key`.

## Proof

- base: af581bbf, `npx vitest run test/resume.test.ts -t "prevents only the keys"` in packages/brumate: fails on `press('k', { metaKey: true })` expecting true.
- branch: same command passes.

## Deviations

- `packages/ui/src/shortcut.ts` is not on origin/release/0.8, so the rule follows the brief's text. The test sits in resume.test.ts with the existing prevent test, not in a new file.

## Stubs left

- None.

## Gotchas

- `pnpm build` is needed before vite.test.ts and website check:samples pass in a fresh worktree.

## Proposed learnings

- None.

## Verification

- brumate vitest (`--maxWorkers=2`): all pass after build, vite.test.ts 33/33; check:samples 67 samples, 0 problems; oxlint no errors; typecheck pass.
- `pnpm format:check`: one file, `nodes/editor-sizes/brief.md`, not owned by this node.

## Size

- Estimated S, actual S.
