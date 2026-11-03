# Outcome: release-0.5

## Built

- brumate 0.5.0 is on npm (2026-11-03). Promotion #434 (`next` -> `main`, merge commit cfdbaecc), Version Packages #435.
- Other packages got patch bumps only for their `workspace:` dependency on brumate: @brumate/language-core 0.2.5, @brumate/language-server, @brumate/tsc and @brumate/typescript-plugin 0.1.9, @brumate/ui 0.1.1.
- The 21 open should nodes of 0.5.0 moved to 0.6.0 (aa4914f4).
- Changesets: 11 merged into 8, none dropped (db636248): the two browser `await` notes, the two client bundle notes, and the two client size patches.
- `next` fast-forwarded to `main` after the release (3d7d7f70).

## Deviations

- The changeset trim went into the promotion branch as one commit on top of `next`, not as its own pull request into `next`.

## Stubs left

- None.

## Gotchas

- Timing-based tests fail when other jobs load the machine (load average 52 to 191 here): devtools, a `resume.test.ts` setup hook, 14 to 20 ui tests. Rerun on a quiet machine before you judge a failure.
- Two `resume.test.ts` tests each failed once in CI on #434 and passed on a rerun (in inbox.md).
- npm showed 0.4.4 for a while after the publish. `npm view brumate dist-tags` showed 0.5.0 later.

## Verification

- On `next` bb4cb4a7 + db636248:
  - `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: pass.
  - `pnpm test`: pass on a quiet machine (brumate 2150, ui 772 + 1 expected fail).
  - `node e2e/run.mjs`: website 72, todos 9, tracker 14, nitro 2, kit 5, ui 55, browser-async 6, no failures.
  - `pnpm --filter website check:samples` and `pnpm --filter website build`: pass.
  - `pnpm pack --dry-run` in packages/brumate: no test files or fixtures.
- `pnpm bench --only brumate --scenario todos`: JS before `load` 5 files, 32.4 kB / 13.6 kB gzip, below the 0.4.1 figure (14.8 kB). 0.4.4 was 14.9 kB.
- Fresh review of #434: no blocking findings.
- #434 CI: green after one rerun of the two test jobs.

## Size

- Estimated S, actual S.
