# Outcome: svg-ambiguous-clone

## Built

- `packages/brumate/src/codegen/template.ts`: `Reader` flags a top element named `a`, `script`, `style` or `title` (`ambiguous`); `cloneLines` returns false for a render with no owner (a component root) whose markup has one, so it renders HTML that the insert parses in the namespace of its place.
- Test `keeps SVG for an ambiguous top element of a body, a component and an item` in `packages/brumate/test/resume.test.ts`, with fixtures `clonedForeignAnchor.brm` and `ClonedAnchor.brm`.
- Patch changeset `.changeset/svg-ambiguous-clone.md`.

## Proof

- base: cdf7f880, `pnpm --filter brumate exec vitest run test/resume.test.ts -t "keeps SVG for an ambiguous"`: fails, `.comp` namespace is xhtml, expected svg.
- branch: same command: passes.

## Deviations

- On main, the `#if` body and `#for` item cases already keep SVG in a browser render (bodies get their foreign context at compile time), so only the component case needed the fix. The re-render of a `#for` after a resume from server markup is not covered by a test: the fixture renders the svg in the browser.
- The nested `em` case only asserts that it renders: `em` breaks out of SVG in the HTML parser, so it has no SVG namespace to assert.

## Stubs left

- None.

## Gotchas

- A component with an ambiguous top element no longer uses a cloned template, so it costs the HTML parse at insert.
- release/0.10 has `hasAmbiguousTop` in `codegen/markup.ts`; the merge may need to join the two checks.

## Proposed learnings

- A template with no known place must not be cloned when its top element has a name HTML and SVG share | the clone fixes the namespace at compile time | packages/brumate/src/codegen | yes

## Verification

- Targeted test: fails on base, passes on branch.
- `pnpm lint` (warnings only, no errors), `pnpm format:check`, `pnpm typecheck`: pass.
- Full `vitest run` in `packages/brumate`: 3618 passed, 1 failed (`test/template.test.ts`, caused by an added `ambiguous: false` field, fixed). After the fix, `template.test.ts` and `resume.test.ts` pass.
- A first full run ran at the same time as `pnpm typecheck` and had many timing failures in `differential-*`. They pass alone.

## Size

- Estimated M, actual S. Only one path needed the change.
- Risk estimated medium, measured low.
