# Outcome: aria-types

## Built

- packages/brumate/elements.d.ts: `AriaAttributes` (all 52 `aria-*` of WAI-ARIA 1.2 with their value types) and `AriaRole` (83 roles of 1.2 and 41 `doc-*`), both exported; `GlobalAttributes` includes `AriaAttributes` and `role` takes `AriaRole`. `aria-${string}` stays for other names.
- packages/brumate/test/elements-types.ts: valid cases and 5 expected errors (wrong `aria-expanded`, `aria-live`, unknown `role`, `aria-level`, `aria-pressed`).
- .changeset/aria-types.md (minor). PR #442 (draft, against next).

## Deviations

- Callers fixed because typecheck must pass across the workspace (5 places): packages/ui/src/Row.brm, ToggleButton.brm, ToggleButtonGroup.brm, packages/ui/test/fixtures/Toggle.brm, packages/tsc/test/fixture/src/Elements.brm (`aria-label=(1)` to `aria-level=(1)`).
- The contract in the worktree is behind main, so it was not edited: contracts/element-types.change-request.md has the v1.4 text.

## Stubs left

- None.

## Gotchas

- A number for `aria-label` or other string attributes is now an error.
- Any `aria-*` outside the list is still unchecked.

## Proposed learnings

- None.

## Verification

- `pnpm lint`, `pnpm format:check`, `pnpm -r typecheck`, `pnpm --filter website check:samples`: pass.
- `pnpm build && pnpm test`: pass except load flakes (devtools.test.ts; bind-kept-writes and token-field-sync in ui), which pass alone.

## Size

- Estimated M, actual M.
