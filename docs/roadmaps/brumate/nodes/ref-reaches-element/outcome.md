# Outcome: ref-reaches-element

## Built

- Link, Button and Heading (packages/ui/src) read `let { ref } = $props<<Name>OwnProps>()` and write `ref=$bind(ref)` on their root, as Toolbar does. `ref=$bind(sig)` now sets `sig` to the rendered element.
- packages/ui/test/ref-forward.test.ts with the page packages/ui/test/fixtures/refForward.brm: each part with a bound ref, and each with `as=AsTarget`, read back after a click.
- A core probe in packages/brumate: `it.fails` "a ref left in the rest props reaches the element that spreads them" in test/resume.test.ts, with test/render/RestRefBox.brm and test/render/restRefPage.brm.
- Changeset .changeset/ref-reaches-element.md (patch).

## Deviations

- The core probe edits packages/brumate/test, outside the owned paths. The brief asked for a failing core test if a binding in a spread should work. It is added as `it.fails`, with no core change.
- The signals in the fixture are `$signal<any>()`, not `$signal<HTMLElement>()`: bound-element-signal (#277) is still open. The stale comment in test/fixtures/as-collections.brm is left for that reason.

## Stubs left

- None.

## Gotchas

- On main, only the plain case fails: the signal of `<Link ref=$bind(sig)>` stays undefined. With `as=AsTarget` the signal is set already, because the component forwards the `ref` prop itself. The second test of ref-forward.test.ts passes on main and guards the case.
- The core does not carry a `ref` binding across a spread onto an element when a component leaves it in its rest props (the `it.fails` probe). A component that forwards a ref destructures it and writes `ref=$bind(ref)`. Whether the core should support the spread is left to the orchestrator.
- The file system of the main machine ignores case: `RefInRest.brm` and `refInRest.brm` are one file. Name a page and its component apart by more than the case.

## Proposed learnings

- A part that forwards a ref destructures `ref` and writes `ref=$bind(ref)`, never leaves it in `rest` | the binding does not cross the spread | packages/ui/src | no

## Verification

- Before the fix: `npx vitest run --maxWorkers=2 test/ref-forward.test.ts` in packages/ui: the first test failed with `- - -` for `A BUTTON H3`.
- After: both tests pass. Whole ui suite: 57 files, 531 passed, 7 expected fail, exit 0. packages/brumate suite: 55 files, 972 passed, 6 expected fail, exit 0.
- `node ../tsc/bin/brumate-tsc.js --noEmit` in packages/ui: exit 0. A deliberate error in test/props-types.ts made it exit 2, so the check is live. `npx tsc --noEmit -p .` in packages/brumate: exit 0.
- `npx oxlint --quiet` and `npx oxfmt --check` from the root: exit 0.

## Size

- No change to the runtime, so no gzip numbers. Estimated S, actual S.
