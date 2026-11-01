# Outcome: runtime-brand-checks

## Built

- `Internal` in `packages/brumate/src/runtime/html.ts` carries the brand `Symbol.for('brumate.internal')` on its prototype. New `isInternal(value)` replaces `instanceof Internal` in `ownValue`, `mergeAttributes` (html.ts) and `InternalPlugin` (serial.ts).
- Classes changed: `Internal` only. It is the one whose failed check drops data silently. `RawHTML` already used a symbol brand.
- Test: `packages/brumate/test/brand.test.ts` (two copies via `vi.resetModules()`; fails on main, passes now).
- The resume.test.ts workaround in the "live style variable" tests is removed.
- Changeset: `.changeset/brand-internal-copies.md` (patch).

## Deviations

- Only `Internal` got a brand. The brief says "a brand per class that crosses modules"; the other classes fail loudly or stay inside one copy (see log.md).

## Stubs left

- None.

## Gotchas

- A computed symbol field on an exported class breaks the d.ts build (TS9038). Set the brand on the prototype.

## Proposed learnings

- Check runtime values that can cross copies of brumate with a `Symbol.for` brand, not `instanceof` | two copies of the runtime fail `instanceof` silently | packages/brumate/src/runtime | no

## Verification

- Reproduction outside vitest: two copies of built dist, `mergeAttributes` dropped the cross-copy `b-on` before the change and keeps it after.
- `npx vitest run test/brand.test.ts test/resume.test.ts` pass.
- Size: see PR body.

## Size

- Estimated S, actual S.
