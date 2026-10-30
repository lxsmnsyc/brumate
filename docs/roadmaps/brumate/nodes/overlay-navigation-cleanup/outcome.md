# Outcome: overlay-navigation-cleanup

## Built

- `packages/ui/src/ModalOverlay.brm`, `Popover.brm`, `Tooltip.brm`: the `$client` cleanup is now `leavePage`. It gives back what the overlay holds (inert, scroll lock, focus, stops) whether or not the element is still connected, and removes the layer.
- Tests: `packages/ui/test/modal.test.ts`, `popover.test.ts`, `tooltip.test.ts` unmount a page with the overlay open and check no layer, no inert node, no scroll lock.
- Review fix: the cleanup also runs when an `#offscreen` body hides, and `$client` runs again on show, so it resets `shown`, `mounted`, `rested` and `leaving` and the overlay opens again on show.
- Changeset `.changeset/overlay-navigation-cleanup.md` (patch).

## Deviations

- `e2e/suites/website.mjs` is outside the brief's paths: one step on /ui/modal opens the modal, follows a sidebar link on the client, and checks no layer, no inert node and no scroll lock.
- `packages/ui/test/overlay-offscreen.test.ts` and `test/fixtures/overlay-offscreen.brm` are new files under the brief's `packages/ui/test/**`.
- A real client navigation was driven in Chrome by the reviewer: branch 0 layers, 0 inert, no scroll lock; main 1 layer, 4 inert nodes, focus stuck.

## Stubs left

- None.

## Gotchas

- Cleanups run before navigation removes the markup, so `isConnected` checks in a cleanup see a connected element. The `$effect` cleanup keeps the check because it also runs on a value change.
- The core's route drop (`removeScope`) does not remove `#portal` markup; the parts remove their own layer.

## Proposed learnings

- A cleanup that must run on dispose must not depend on `isConnected` | navigation runs cleanups before it removes markup | packages/ui/src | no

## Verification

- `npx vitest run test/modal.test.ts test/popover.test.ts test/tooltip.test.ts` in packages/ui (Chrome): 51 pass; 7 fail with the source change reverted.
- `test/overlay-offscreen.test.ts`: hide and show of an open modal, popover and tooltip; 2 of 3 fail without the state reset.
- `pnpm typecheck` passes. `pnpm lint` and `pnpm format:check` fail only on files under `docs/debates/` that are on main; nothing in changed files.

## Size

- Estimated S, actual S.
