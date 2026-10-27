# Outcome: style-vars-target

## Built

- `packages/brumate/src/runtime/client/inserts.ts`: `withVariables` appends the live style variables of the element after the new style, and no longer skips one that the new style names. An older value in a `style` prop, such as the rest of a component target, no longer wins over the live one.
- Test: `resume.test.ts`, describe "a live style variable of a part with a component in as" (fixtures `gapStyleVarPart.brm`, `gapStyleVarTarget.brm`, `gapStyleVarElement.brm`, `gapStyleVarComponent.brm`). Both targets are checked.

## Deviations

- The bug does not show with the style variable alone. It needs another live prop on the part's tag, such as `aria-selected=(size > 12)`, which makes the target's rest live and rewrites its attributes. The test has that prop.

## Stubs left

- None.

## Gotchas

- A test that sends an `Internal` in the page state, after any earlier loader run in the same file, must render with `await import('../src/runtime/server.ts')` after importing the fixture. The static `renderParts` holds the class of the old module graph.

## Proposed learnings

- None.

## Verification

- `npx vitest run test/resume.test.ts -t "style variable"` in packages/brumate: gapStyleVarComponent fails on main (timeout), both pass with the fix.
- `npx vitest run` in packages/brumate: 1061 passed. `npx vitest run --maxWorkers=2` in packages/ui: 537 passed, 1 expected fail.
- `npx tsc --noEmit -p .` in packages/brumate: exit 0. `npx oxlint`: warnings only. `npx oxfmt --check`: pass.

## Size

- Gzip -9 of the `client-*.js` chunk of `npx tsdown`: 34747 B to 34735 B (-12 B). `produce` unchanged. `pnpm bench` not run.
- Estimated S, actual S.
