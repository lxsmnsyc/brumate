# Outcome: checkbox-description

## Built

- Checkbox (outside a group) and Switch give a `Text slot="description"` and a `FieldError` in their children an ID, and the input names them in `aria-describedby`: the description once present, the error only while invalid. In a group, the group still owns both.
- Checkbox shows the browser's message in a FieldError without children after a failed submit. Switch takes a new `isInvalid` (`aria-invalid`, `data-invalid`).
- Docs: checkbox.md and switch.md lose the "not tied yet" notes. CheckboxConsentDemo uses Text and FieldError.

## Deviations

- website/ui/demos/CheckboxConsentDemo.brm and packages/ui/test/fixtures/boxes.brm are outside the listed paths (the brief's "give the consent demo its description back" and the test need them).
- Added `isInvalid` to Switch.
- The Chrome accessibility tree was checked through the attributes in a browser test (vitest runs in Chrome), not by opening the tree by hand.

## Stubs left

- None.

## Gotchas

- Description and error sit inside the label, so the label text of the box includes them.

## Proposed learnings

- None.

## Verification

- `pnpm typecheck`, `pnpm --filter website check:samples` pass. `pnpm lint` and `pnpm format:check` fail only on docs/debates/pending-handler-reads (not in this change).
- `vitest run test/boxes.test.ts test/form-reset.test.ts test/fields.test.ts test/validation.test.ts` passes, with the new test.

## Size

- Estimated S, actual S.
