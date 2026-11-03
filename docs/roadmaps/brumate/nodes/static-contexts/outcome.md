# Outcome: static-contexts

## Built

- A context is live only when the browser may need its value. `analyzeProjectAll(files, resolve)` in `packages/brumate/src/project.ts` finds the live props and the live contexts in one fixpoint. `analyzeProject` and `analyzeProjectProps` stay.
- Design. A context has the name it is exported by (`contextName` in analyze.ts; `ns.Name` gives `Name`). A name is live when a `$setContext` call of it:
  - gets a value that is live in the graph of its file,
  - holds a function (the readers call it in the browser),
  - sits in a scope that the browser creates, or in a file the browser renders, or
  - has a name that is not a plain name (then `*`: every context is live),
    or when a reader of it sits in a scope or a file that the browser renders. A file is browser-rendered when a created body or template of another file renders it, when a browser-rendered file renders it, or when it is in the children of a component whose file creates scopes. `as=Target` components follow the same rule.
- `buildGraph` takes `liveContexts`; a `$getContext` declaration is live only when its name is in the set. Without the option every context is live, as before. Built-ins (`$route`, `$navigation`) have no name and stay live.
- The server `provide` takes a fourth argument, `false` for a static context, and then the value stays out of the page state (`record.v`). This is what keeps a looked-up table from shipping.
- The Vite plugin runs the analysis with the props and passes `liveContexts` to files it analyzed.
- Tests: `test/static-contexts.test.ts` (7), pages `test/render/staticContext{Page,Live}.brm` with `StaticContextReader.brm`, `StaticContextMood.brm` and `staticContext.ts`, and a `static contexts` block in `test/render.test.ts` that checks the page state. `differential/run.ts`, `render.test.ts` and `resume.test.ts` now compile with `liveContexts`. Both pages render the same on the server and in the browser.
- Decision recorded in `docs/decisions.md`. Changeset `.changeset/static-contexts.md` (minor).

## Result

Not an experiment node.

## Deviations

- Edited files outside the brief's paths: `packages/brumate/src/project.ts`, `compile.ts`, `model.ts`, `vite.ts`, `index.ts`, `runtime/server.ts` (the `provide` flag). All are needed for a whole-program analysis.
- The move of the strings lookup back into the date parts of packages/ui was checked, not made. A probe project (provider with a locale from a prop, a part with `$memo(getDateStrings(locale))` and a handler) ships `getDateStrings` in the update part before and not after, so it is possible. The move touches six parts and their tests and is a separate change.
- `cli.ts` (`brumate inspect`) and `check-command.ts` still compile without `liveContexts`, so they report every context as live. Diagnostics do not depend on it.
- Test pages `StaticContextReader.brm` and `StaticContextMood.brm` do not match `staticContext*.brm` (they are components, capitalised); they are under `test/**`, which is shared.

## Stubs left

- None.

## Gotchas

- A context re-exported under another name (`export { A as B }`) is not followed: the provider and the reader would have two names, and the reader could be seen as static while a provider is live. Export contexts under one name. Recorded in decisions.md.
- Two contexts with the same export name in different modules count as one: the result is more live, never less.
- A signal that nothing writes is not live, so `$setContext(Ctx, signal)` with no writer is static.
- A new `$getContext` read in code the browser renders makes the context live for every reader.
- Under a load average of 20, the differential and render suites time out at 5 s and 10 s. Rerun alone.

## Proposed learnings

- Pass `liveContexts` from `analyzeProjectAll` wherever a test compiles pages with `liveProps` | a test that omits it compiles every context as live and misses the analysis | packages/brumate/test | no

## Verification

- `pnpm lint && pnpm format:check && pnpm typecheck`: pass (lint has only old warnings).
- `pnpm build`: pass. `pnpm test`: the brumate run timed out in 8 files under load; those 8 files pass alone with `--maxWorkers=3` (1260 tests). The other packages, ui (772 + 1 expected fail), website (268), examples pass.
- `pnpm --filter website check:samples`: 65 samples, 0 problems.
- `pnpm bench --only brumate --scenario todos`: JS before `load` 5 files, 32.4 kB raw / 13.6 kB gzip. Todos reads no context, so the figure does not move. I did not rerun the base.

## Size

- Website, all emitted JS, gzip: 1,373,299 B before, 1,372,402 B after (-897 B). Home entry set: 88,619 B before, 88,618 B after. Before = same build with `liveContexts: undefined`. The ui example was not measured on its own: the ui and examples suites pass.
- Estimated M, actual M.
