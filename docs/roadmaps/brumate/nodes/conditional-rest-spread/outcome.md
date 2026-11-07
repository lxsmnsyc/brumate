# Outcome: conditional-rest-spread

## Built

- Analyzer (packages/brumate/src/analyze.ts): a markup spread may hold the props object or the rest as a branch of `?:`, `&&`, `||` or `??`. The other branches must be an object literal, `undefined`, `null`, `false`, or the same name. A call, a nested condition, `a ? rest : other` and the rest in the condition stay BRM115. `spreadsWhole` decides; `conditionalSpread` (exported) finds the rest branch for codegen.
- First render needed no change: `spreadsRest` already reads props, so `restRef` forwards a `ref` that is in the values, and an off branch has none.
- Update in the browser: `attrs`/`fillAttrs` (runtime/client/inserts.ts, waits.ts) take a last argument `held`, the `ref` of the rest. codegen/client.ts (`heldRef`) emits it only for a conditional spread, as `, (rest).ref`. `forwardRef` remembers the target it gave each element (`forwarded` WeakMap) and sets the signal to `undefined` when a later update has no `ref`. `held` covers the first update of an element the server rendered, where the browser has no memory.
- runtime/client/props.ts `prop()`: a rest key was deleted when the binding value was undefined, so a cleared `ref` left the rest for good. A binding of a signal now stays. The binding stays for setters too.
- Setter refs: `take` in updates.ts calls the setter with `undefined` once when the branch turns off and forgets the element, so the next `give` calls it with the element. Setters are compared by their handler reference (`setterKey`), since the browser makes a new function at each parent update; comparing functions looped (BRM187).
- Fixtures: test/render/conditionalRestBox.brm, conditionalRestPage.brm, conditionalRestOffPage.brm, conditionalRestBlockPage.brm.
- Extra tests: a setter ref flipped both ways with exact call counts, and a dynamic tag (fixtures conditionalRestSetterPage.brm, conditionalRestTag.brm, conditionalRestTagPage.brm).
- Tests: check.test.ts ("a conditional spread of the rest", 3 tests), resume.test.ts ("a conditional spread of the rest props", 3 tests: starts true, starts false, in a block the browser renders; each flips both ways).
- Docs: BRM115 text in error-catalog.ts, website/docs/errors.md and skills/brumate/references/errors.md. Changeset `.changeset/conditional-rest-spread.md` (minor brumate).

## Deviations

- Edited outside the shared list: packages/brumate/src/runtime/client/props.ts, runtime/client/updates.ts, runtime/client/waits.ts, test/differential/data.ts (`conditionalRestPage` and `conditionalRestTagPage` added to the `lazy-ref` divergences, like the other rest-ref pages), website/docs/errors.md and the skill's errors.md (copied from the catalog by hand; no generator found).
- No new error code.

## Stubs left

- None.

## Gotchas

- `||` and `??` branches: `open || rest` is still an error (`open` is not empty). Write `false || rest` style, or use `&&` / `?:`.
- The update argument is `(rest).ref`, read in the update, so a conditional spread also reads the `ref` key of the rest there.

## Proposed learnings

- None.

## Verification

- `pnpm --filter brumate exec vitest run test/resume.test.ts -t "conditional spread of the rest"`: pass.
- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: pass. `pnpm --filter brumate test`: 3010 passed. `pnpm --filter @brumate/ui test`: 783 passed, 1 expected fail.
- One run of ResolveGoneChild (differential-4) failed under load and passed alone and in the later full run.

## Size

- `pnpm bench --only brumate --scenario todos`: base and branch equal at the reported precision (JS before load 33.0 kB / 13.8 kB; client JS in dist 78.6 kB / 27.7 kB). The core change is a few lines; the 0.05 kB limit is not measurable at that precision.
- Estimated S, actual M. The update path, the server-rendered start and the rest losing its binding needed work.
