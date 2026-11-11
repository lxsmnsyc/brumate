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

## Rework

The goal was misread (maintainer, 2026-11-11): a block style replaces the separate style of the component. The
`<style>` at the top level of a file is the style of the outermost block, and one rule and one code path cover both.

Built

- `packages/brumate/src/ast.ts`: `fileBody(file)` is the body of the file itself (script, styles, templates,
  markup). `BodyInfo.template` marks template bodies.
- `packages/brumate/src/css.ts`: `compileStyles` compiles every body that has CSS in one loop, the file's body first.
  `StyleOutput.blocks` holds the file's style as its first entry with its names unchanged
  (`b-c-<hash>`, `--s-<hash>-<k>`); a block keeps `b-c-<hash>-<n>` and `--s-<hash>-<n>-<k>`. `bodyStyles` gives the
  file's style to every body as an attribute, and as variables to the bodies at the top level of the file. A
  template counts as top level for the file's style only, since it renders anywhere (as before).
  `StyleOutput.attribute`, `variables` and `targets` stay and describe the file's style. `hasComponentCss`, the
  `inBlock` check and `GLOBAL_IN_BLOCK` are gone.
- `markup.ts` and `client.ts` have no separate component path: `hasScope`, `hasComponentVariables` and the
  `styles.hasComponentCss`/`styles.variables` branches are replaced by `blockStyles(scope)` (`scope.body ?? fileBody`).
  `plan.ts`: `liveStyles` is gone; `liveBlocks` holds `fileBody(file)` when the file's style is live.
- `<style global>` and `:global(…)` work in a block as at the top level. BRM205 and BRM206 are deleted (never
  released, and the catalog has no retired list, so the numbers stay unused). BRM207 stays: `#reveal` is a
  fragment with no body scope, so a separate path for the file does not make it moot.
- Tests: `block-styles.test.ts` replaces the two error tests with "global markers in a block" (a `<style global>` in a
  `#for` gives the same sheet as at the top level, with no attribute; `:global(…)` in a block style unwraps and
  scopes the rest). `test/styles.test.ts` is unchanged and passes.
- Docs: styles.md, control-flow.md, grammar.md, proposals.md, the decisions.md entry (rewritten, one entry), the
  style-global entry, SKILL.md, references/syntax.md, the changeset. Error docs regenerated with `UPDATE_SKILL=1`.

Proof for files without block styles

Every `.brm` under examples, packages/ui, website, e2e, benchmarks and the brumate test fixtures (697 files, dev
and build, server, client, render, table, css and parts) compiled on the branch before the rework and after it:
1378 of 1380 outputs are byte-identical. The two that differ are the `update` part of `ColorThumb` (dev and build),
one intended difference in a client render function:

- A row that the browser renders inside an element (`<div>{#for …}`) no longer repeats the style variables of the file
  (and `b-v`) on its own top-level element. The server never wrote them there, and the element around the rows
  carries them, so the rows inherit the same values and a live change reaches the element around. The old browser
  path wrote them because each render function restarted its nesting at 0. The block rule (top level of the body
  only) now covers the file's style too.

The `b-v` of the file's style is still its scope variable, not `.id` (kept so the output is the same).
In the client prologue the style sites of the file are still read for every render function (`!site.scope.body`),
since the file's variables also go on the top-level elements of children that a component passes.

Deviations

- None from the brief. `blocks` now includes the file's style (first), which `block-styles` code and tests read
  through `plan.styles.blocks`; they pass unchanged.

Verification (rework)

- `pnpm --filter brumate exec vitest run test/styles`: 45 tests pass, `test/styles.test.ts` unchanged.
- Full brumate suite: 3109 passed; load-only failures pass alone (see log.md). lint, format:check, typecheck pass.
  `check:samples` 69 samples, 0 problems. e2e website 74 passed. Bench todos: 13.8 kB gzip JS before load, 13.8 kB
  after counter, toggle, add, 27.7 kB emitted: unchanged.
