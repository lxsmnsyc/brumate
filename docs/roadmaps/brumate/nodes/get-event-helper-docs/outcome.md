# Outcome: get-event-helper-docs

## Built

- `website/docs/server-functions.md` and `website/docs/reference-server.md` say that the compiler rewrites `getEvent()` only in `.brm` code, so a `.ts` helper that calls it during render throws after an ancestor awaited. Both say to call it in the component script and pass the event to the helper. The first page has a short `.brm` example.

## Deviations

- None.

## Gotchas

- `pnpm format:check` reports docs/roadmaps/brumate/nodes/editor-sizes/brief.md, which this node does not touch.

## Verification

- `pnpm --filter website check:samples`: 67 samples, 0 problems (after `pnpm --filter brumate build`).
- `pnpm format:check`: only the editor-sizes brief fails; the two edited pages pass.

## Size

- Estimated S, actual S.
