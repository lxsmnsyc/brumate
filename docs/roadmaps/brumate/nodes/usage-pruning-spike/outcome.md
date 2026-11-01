# Outcome: usage-pruning-spike

## Built

Prototype code on `spike/usage-pruning-spike`. It is a record of the spike, not product code to merge.

- The branch head holds approach F: five more feature flags in `packages/brumate/src/features.ts` and `packages/brumate/src/runtime/features.ts`, read in `runtime/client/{errors,resume,inserts,lists,context}.ts` and in the `loader` object of `runtime/client.ts`. `vite.ts` turns `routes` on when client navigation is on.
- `prototype-flags.patch`: approach F against `next` at 6adea8fb.
- `prototype-imports.patch`: approach T against `next`, with its snapshot update. This patch also holds a `BRUMATE_SPIKE_ON` switch in `vite.ts`, which forces flags on so each flag can be measured alone. The F patch and the branch do not have it.
- Scripts in this folder:
  - `build.sh <label>`: builds packages/brumate, the todos, dashboard and rows benchmarks, and the website (skip it with `SKIP_WEBSITE=1`), then runs `size.mjs`.
  - `size.mjs`: gzip -9 bytes of the JS a page loads at start. For the benchmarks this is hints.json plus the entry, the same files as the bench adapter. For the website it is `hints.all`, the files every page loads. The core chunk is also printed alone.
  - `smoke.mjs`: opens todos and rows in Chrome and runs counter, toggle and add on todos, and select, update, swap, remove, create and clear on rows. It checks each result and prints the share of core bytes that ran. With `DUMP=n` it lists the n largest functions that never ran, named from the source maps.

## Result

- result: met. A page can drop runtime paths it never uses, from facts the compiler already has: about 1 kB gzip on the benchmarks. Go for approach F.
- numbers: gzip -9 bytes of JS before `load`, one build each. Sizes are exact, so there is no noise.

| Page                                  |   Base | F (flags) |       F saving |  T (imports) |     T saving |
| ------------------------------------- | -----: | --------: | -------------: | -----------: | -----------: |
| todos                                 | 14,825 |    13,806 | -1,019 (-6.9%) |       13,918 | -907 (-6.1%) |
| dashboard (50 widgets)                | 24,767 |    23,880 |   -887 (-3.6%) |       23,980 | -787 (-3.2%) |
| rows                                  | 14,566 |    13,552 | -1,014 (-7.0%) |       13,680 | -886 (-6.1%) |
| website, as built (`features: 'all'`) | 35,687 |    35,709 |            +22 |       35,918 |         +231 |
| website with `features: 'used'`       | 35,584 |    35,178 |   -406 (-1.1%) | not measured |              |

- Each F flag off alone, on todos (B gzip): `fields` -299, `tries` -271, `windows` -202, `routes` -202, `dynamic` -187. They add up to 1,161; all five together save 1,019, since gzip overlaps.
- The core alone on todos goes from 28,217 to 25,452 B raw (11,070 to 10,052 gzip). The share of core bytes that runs on todos goes from 47% to 50%.
- The website builds with `features: 'all'`, because the REPL and the live samples compile components in the browser. No approach saves anything there unless that code gets a core of its own. With `'used'`, the REPL would break; that build was only for measuring.
- reproduce: branch `spike/usage-pruning-spike` from `next` at 6adea8fb. Run `sh docs/roadmaps/brumate/nodes/usage-pruning-spike/build.sh f`, then `node docs/roadmaps/brumate/nodes/usage-pruning-spike/smoke.mjs`. For base, check out `packages` from `next`; for T, apply `prototype-imports.patch` to `next`. Apple M2, Node 26.12.1, Vite 8.3.4, Chrome 156.

### Question 1: what the compiler can prove a page never needs

Each fact is a match on the compiled output of a component, joined over the build like the existing flags:

| Path                                                                                                    | Fact                                                                            | Saving on todos |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------: |
| `readFields`, `typedInto`, `fieldValue`, `isBox` (read fields the user typed in before the core loaded) | no element `$bind`: no `=$bind#` and no `=$set:` in `b-on`                      |           299 B |
| The `#try` search in `fail`, `catchInto`, `replaceTry`                                                  | no `#try`: no `$$b.caught(` on the server and no `export const t` on the client |           271 B |
| The parking of `list` (`leave`, `back`, `redraw`)                                                       | no `$$b.windowList(`                                                            |           202 B |
| `currentRoute`, `setGlobal`, `updateRoute` (which the `loader` object kept on every page)               | no `$$b.routeContext` or `$$b.navigationContext`, and `navigate: false`         |           202 B |
| `prop` from `attr` (a dynamic tag that names a component)                                               | no `$$b.dynamic(` or `$$b.dynamicNodes(`                                        |           187 B |

The `b-fail` record also moved under `lateMarkup`, since only `#loading` bodies send it. That is perf-pass option B.

These cold paths have no fact the compiler can prove:

- `asyncMemo`, `startLoading`, and the `refresh` of client-rendered scopes in `insert.ts` (`refresh(live, true)`). Any memo can return a promise. The brief's 251 B for a `refresh` flag assumes no async memos, which no fact proves. perf-pass-0.4 found the same for `asyncMemo`.
- The skew reload (`serverBuild`, `loadOnce`, about 380 B raw min). It depends on a deploy, not on the page.
- `destroyRange`, `removeScope`, `destroy` and the `leave` of lists. They did not run in the coverage, but removing an item needs them.

Cold paths not checked in the time box, as raw minified bytes on todos:

- the `html.ts` helpers that the core keeps (`styleValue`, `insertValue`, `switchWords`, `toKebabCase`, `escape`): about 600 B
- the serial plugins of `produce.ts` (`useSerialEntry`, `registerValues`, `Binding`, `SlotReference`): about 700 B
- `send` (props to a child): 224 B
- `withVariables` (CSS variables in `style`): 191 B

`smoke.mjs` with `DUMP=90` lists the rest.

### Question 2: flags, imports, or a runtime per build

- F, feature flags: the existing mechanism. The plugin writes `true` or `false` into the core, and the minifier drops the branch. Nothing is left at run time. Each flag is a regex in `getFeatures`, a line in three tables, and 3 to 10 lines in the runtime. All five flags take about 90 lines.
- T, tree shaking by imports, built for the same five paths. The core reaches each path through `hooks`, and an installer export (`useTries`, `useFields`, `useDynamic`, `useRoutes`) sets the hook. The client module of a component that uses a path imports and calls the installer. Codegen would emit these imports; the prototype appends them in `compile.ts` from the same facts. Windowed lists need no installer: `windowList` passes the park code to `list` as functions, so plain tree shaking drops it. T is 100 to 130 B gzip larger than F on every benchmark, and +231 B on the website. Each hook costs a property read and a call, and each installer costs an export, an import and a call. T also has a load-order trap: a component module can evaluate after `init`, so `useFields` must read the fields itself when the core has started. Its one advantage is the windowed list, which needs no fact. That refactor also works under F.
- A runtime generated per build: not built. With the same facts, its output would match F, because F's flags are constants by the time the minifier runs. It would also add a build of the runtime source to every app build. It has no gain to measure.

Chosen: F. It gives the most bytes, adds nothing at run time, and extends a mechanism the plugin already has.

### Question 3: shared chunks when pages use different sets

Rolldown splits chunks by module. The core is one module, the single dist file that tsdown makes of `runtime/client.ts`. Every page of a build therefore loads the same core chunk: on the website, all 351 bundles share the one core in `hints.all`. Under F, the core holds the union of the build's features, because `joinFeatures` runs once for each build. Under T, it holds every installer that any component imports. Neither approach gives each page its own set.

Per-page sets would need the optional paths split into modules of their own, which means more requests. They would also stop at client navigation, which loads other pages' code into the same core. The gain is small anyway. These paths total about 1 kB on a page that uses none of them, and real apps use some:

- `packages/ui` uses `dynamic` in 44 of 107 parts (the `as` prop) and `windows` in 4.
- The website uses `routes` and `dynamic`.
- The examples hackernews, tracker and todos use none of the five.

Keeping one core per build, with the union of its features, is the right trade.

## Deviations

- The website figure is reported two ways, as built and with `features: 'used'`. As built, it compiles components in the browser and cannot prune.
- No `pnpm bench` run. Sizes are exact and need no timing. The smoke check in Chrome replaced the bench interactions.
- The brief's other audit candidates (string branches 34 B, repeated template code 21 B) were left out. They are code tidying, not pruning by use.

## Stubs left

- The prototype has no tests with a flag off. The brumate tests run the runtime source with every flag on. The flag-off paths were checked only by `smoke.mjs` on todos and rows. The build node must add tests that build an app with each flag on and off, check what the core chunk holds (as `test/features.test.ts` does), and run a page with the flag off.
- `test/feature-flags.test.ts` has no cases for the new facts yet.

## Gotchas

- A fact regex that misses a use leaves code out of a page that needs it. The plugin already warns about a component that the feature count did not see (`vite.ts`, "which the client build left out of the core"). New flags go through the same check, since it loops over `Features`.
- `routes` must stay on with client navigation: `loader.ts` calls `setGlobal` and `updateRoute` through the core. The prototype sets `features.routes ||= options.navigate !== false`.
- `fields` covers only `=$bind#` and `=$set:` in `b-on`. The `hooks.field` of parts such as a `contenteditable` runs inside the same loop, so it needs no fact of its own.
- Any app that uses @brumate/ui keeps `dynamic` on. The saving there is about 0.8 kB, not 1 kB.
- Under T, an installer that reads the page at start must run itself when the core has already started. Component modules can evaluate after `init`.

## Proposed learnings

- A core path that only some components use gets a feature flag with a fact from the compiled output, not a hook set by an import | hooks cost 20 to 30 B gzip each and gave per-page sets no better than flags, since the core is one module | packages/brumate/src/runtime/client | yes (`test/features.test.ts` builds with and without and reads the core chunk)
- The `loader` object keeps everything it names on every page | it is the one import of the core that is never tree shaken | packages/brumate/src/runtime/client.ts | yes

## Verification

- `pnpm --filter brumate test` (vitest, `--maxWorkers 2 --testTimeout 30000`), on F: 65 files, 1,305 passed, 1 skipped.
- The same tests on T: 1,303 passed. The 2 failures were the render snapshots `blocks` and `retry`, which changed only by the installer lines. They pass after the update in `prototype-imports.patch`.
- `node smoke.mjs` on base, F and T: every interaction passes on todos and rows, with no page errors.
- Fast check on the branch: `pnpm lint` (0 errors), `pnpm format:check` (clean), `pnpm typecheck` (clean, after `pnpm build` in the worktree).

## Size

- Estimated M, actual M. The prototypes took less than the time box; the measuring loops, mostly website builds, took most of it.

## Proposed build node

- `usage-pruning-flags` (S to M, 0.5.0): land approach F as `prototype-flags.patch` has it.
  - Add the flag-off tests listed under Stubs left.
  - Add the `getFeatures` cases.
  - Expected: about -1.0 kB gzip on todos and rows, -0.9 kB on the dashboard. This puts todos below the 0.4.1 figure, as the 0.5.0 acceptance asks.
  - Optional in the same node: the windowed-list refactor from T. `list` takes the park code from `windowList` as functions, which drops the `windows` fact.
- Then decide whether to check the cold paths not covered here (`html.ts` helpers, serial plugins, `send`, `withVariables`, about 1.7 kB raw min) the same way.
