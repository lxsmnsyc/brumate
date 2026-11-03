# Outcome: a11y-in-tests

## Built

- `checkAccessibility(options)` on what `mount` and `visit` return (`Checks` in packages/brumate/src/runtime/testing.ts). It loads axe-core with a dynamic import, runs it, and throws with each violation, its HTML and its fix summary. A missing axe-core throws "Install it with: npm install --save-dev axe-core".
- Options: `rules` (axe rule IDs to turn on or off). Page rules are off for `mount`. For `visit`, the landmark rules (landmark-*, region, page-has-heading-one) are off while an `[inert]` or `[aria-modal="true"]` element exists. Layout rules are always off.
- axe-core is an optional peer dependency (`>=4.8`) and a dev dependency of brumate. Lockfile change: 3 lines.
- Tests: packages/brumate/test/testing-a11y.test.ts with the fixture in test/testing-a11y/. Docs: Accessibility section in website/docs/testing.md. Changeset .changeset/a11y-in-tests.md (minor).

## Deviations

- Added test/testing-a11y/ (a folder) under the brief's shared `packages/brumate/test/**`.
- Added test/testing-a11y/visit.fixture.ts (created with `createVisit` and a fake route, not Lobby.brm): a page with no `<main>` throws, and a page with an `inert` element passes.
- After review: for `visit` with an inert or `aria-modal` element, only the landmark rules are off. `document-title`, `html-has-lang`, `html-lang-valid` and `bypass` stay on.

## Stubs left

- None.

## Gotchas

- Not-found axe-core is detected by any import failure, so an error inside axe-core also reports the install message (the cause is attached).
- Under load, render.test.ts and resume.test.ts time out in a full run.

## Proposed learnings

- None.

## Verification

- `pnpm lint && pnpm format:check && pnpm typecheck`: pass (typecheck needs `pnpm build` first in a fresh worktree).
- `pnpm build`: pass. `pnpm test`: 5 files failed under load (render, resume and others); render and resume pass alone, test/testing* pass.
- `pnpm --filter website check:samples`: pass.
- `pnpm pack --dry-run`: same files; dist/runtime/testing.js is 18.1K. axe-core appears only as an import in testing.js; no client bundle has it.

## Size

- Estimated S, actual S.
