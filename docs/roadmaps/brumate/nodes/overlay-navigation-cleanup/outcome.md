# Outcome: overlay-navigation-cleanup

## Built

- `packages/ui/src/ModalOverlay.brm`, `Popover.brm`, `Tooltip.brm`: the `$client` cleanup is now `leavePage`. It gives back what the overlay holds (inert, scroll lock, focus, stops) whether or not the element is still connected, and removes the layer.
- Tests: `packages/ui/test/modal.test.ts`, `popover.test.ts`, `tooltip.test.ts` unmount a page with the overlay open and check no layer, no inert node, no scroll lock.
- Changeset `.changeset/overlay-navigation-cleanup.md` (patch).

## Deviations

- None. Real client navigation is not driven in a browser route test; the unit tests use the unmount of the test harness, which runs the same scope cleanups (`removeScope`) that `leavePage` and the route drop run, and leaves markup in place as they do.

## Stubs left

- None.

## Gotchas

- Cleanups run before navigation removes the markup, so `isConnected` checks in a cleanup see a connected element. The `$effect` cleanup keeps the check because it also runs on a value change.
- The core's route drop (`removeScope`) does not remove `#portal` markup; the parts remove their own layer.

## Proposed learnings

- A cleanup that must run on dispose must not depend on `isConnected` | navigation runs cleanups before it removes markup | packages/ui/src | no

## Verification

- `npx vitest run test/modal.test.ts test/popover.test.ts test/tooltip.test.ts` in packages/ui (Chrome): 51 pass; 7 fail with the source change reverted.
- `pnpm typecheck` passes. `pnpm lint` and `pnpm format:check` fail only on files under `docs/debates/` that are on main; nothing in changed files.

## Size

- Estimated S, actual S.
