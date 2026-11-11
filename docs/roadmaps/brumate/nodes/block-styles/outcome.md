# Outcome: block-styles

## Built

A custom property that a block style reads now follows its values after the first render, for server rows after
resume and for rows, branches and templates that the browser renders.

- `packages/brumate/src/plan.ts`: `Plan.liveBlocks` is the set of bodies with a live `style` site. Their body scope
  gets `needsId`. `liveStyles` still counts component sites only.
- `packages/brumate/src/codegen/client.ts`: the `style` site finds its variable among the component's and the
  block styles', and emits `u<n>($$s)` with `$$b.setVar($$s, name, value)`. The scope is the body instance, so one
  row's change does not touch another.
- `packages/brumate/src/codegen/markup.ts`: `liveVariableScopes(scope)` gives the IDs for `b-v`: the component's when
  it has live variables, and the instance of each live block whose variables the element carries. `emitLiveStyles`
  and the dynamic tag path use it. One ID is written as it was; several are one space-separated value.
- `packages/brumate/src/runtime/client/page.ts`: `setVar` reads an index from ID to the elements that list it in `b-v`.
  One pass builds it. A `MutationObserver` (child changes and `b-v` changes) drops it, and `takeRecords()` catches
  changes that it has not reported yet.
- `packages/brumate/src/runtime/navigate.ts`: navigation shifts each ID of a `b-v` list.
- Tests: `packages/brumate/test/styles/block-styles-live.test.ts` (8 tests, happy-dom, server render then loader
  resume): a click changes one row, a keyed reorder keeps each row's values, a field of the item changes a row, a
  row the browser adds works and updates, an `#if` branch that opens writes its variables and follows a component
  signal, two nested blocks on one element update separately, a component root that is also the top level of a block updates
  both values, and 1000 rows that share a value update within 4 s.
- Docs: "A style in a block" in `website/docs/control-flow.md` and `website/docs/styles.md` (live samples),
  `docs/grammar.md` (`BlockStyle`), `docs/decisions.md` (one entry), the brumate skill (`SKILL.md`,
  `references/syntax.md`), `.changeset/block-styles.md` (minor for `brumate` and `@brumate/language-core`).
- e2e: `e2e/suites/website.mjs` step "a click changes the style of one row" on the control-flow sample.

## Proof

Not a fix.

- base: 0abbb2ce, `pnpm --filter brumate exec vitest run test/styles/block-styles-live.test.ts`: the first case
  fails. The click runs the handler but the row's custom property stays `none`; the client has no update function
  for the block site. See log.md.
- branch: the same command passes.

## Deviations

- `packages/brumate/src/runtime/navigate.ts` is outside the brief's paths. One line: `b-v` can list several IDs.
- `b-v` holds a space-separated list and `setVar` uses `~=`, so an element at the top level of a block inside
  another carries both IDs. The brief had one ID per element.
- `setVar` first queried the document for each call. Review fix: 1000 rows sharing one value took 13002 ms in
  happy-dom before and 918 ms after (see log.md).
- The docs say that elements a block writes as children of a component keep the block attributes, and that
  `{children}` inserted by the block get none (accepted rule from the review of block-styles-scope).

## Stubs left

- None.

## Gotchas

- In a browser render function `createScope` returns the numeric ID, so `$$s2` is the ID itself; a scope outside the
  render is an object and needs `.id` (`liveVariableScopes` does this with `isInside`).
- Scope IDs made in the browser are negative (`-1`), and `~=` matches them as tokens.
- The test harness in `block-styles-live.test.ts` is its own copy of the compile-and-resume steps of
  `resume.test.ts`; it writes to `test/.output/block-styles-live/`. Names must end in `.brm`, or the client part
  imports do not resolve.

## Proposed learnings

- Test a live browser-render path with a row added by the browser, not only the server rows | the render function and the resume path build `b-v` differently | packages/brumate/test | no

## Verification

- `pnpm --filter brumate exec vitest run test/styles`: pass (43 tests).
- `pnpm lint`: no errors. `pnpm format:check`: pass. `pnpm typecheck`: pass. `pnpm --filter website check:samples`: 69 samples, 0 problems.
- Full brumate suite after the review fixes (`npx vitest run` in packages/brumate): 3109 passed, 3 failed and `render.test.ts` failed to load, under load. Run alone once: render, resume and search-params pass, `differential-4` ResolveGoneChild failed once with the others and passed alone (139 tests). It also failed once under load on the first commit, so it is load, not the change.
- `node e2e/run.mjs --only website`: 74 passed, 0 failed, including the new block style step.

## Size

- Bench `pnpm bench --only brumate --scenario todos` (dist rebuilt before each run, also after the `setVar` index), gzip:
  - JS before load: base 13.8 kB, branch 13.8 kB. Total JS after counter, toggle, add: 13.8 kB on both.
  - Client JS emitted in dist: 27.7 kB on both.
- Estimated M, actual M.
