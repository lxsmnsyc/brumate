# Outcome: split-client-runtime

## Built

`packages/brumate/src/runtime/client.ts` (4,747 lines) is now a facade of 130 lines: it re-exports the same 126 names and holds `loader`. The code is in `packages/brumate/src/runtime/client/`. A module imports only the modules before it in this order, because `import/no-cycle` is an error in this repo: state, code, blocks, references, scopes, titles, insert, children, errors, updates, guesses, props, handlers, context, templates, branches, lists, inserts, components, page, resume.

| Module     | Lines | Holds                                                                                   |
| ---------- | ----: | --------------------------------------------------------------------------------------- |
| state      |   294 | types, `options`, `scopes`, `hooks`, registries, `configure`, `setHiding`, `setGuesses` |
| code       |    87 | loading of modules and parts                                                            |
| blocks     |   265 | marker observer, index, finders, ranges, `nameComment`                                  |
| references |    71 | `resolve`, `call`, `serverBuild`                                                        |
| scopes     |   296 | scope tree, `createScope`, `removeScope`                                                |
| titles     |    62 | `<title>` sync                                                                          |
| insert     |   263 | `insertHTML`, `refresh`, `parseHTML`                                                    |
| children   |   204 | `Children`, `TemplateCall`, `insert`                                                    |
| errors     |    66 | `fail`, `catchInto`                                                                     |
| updates    |   533 | slots, `set`, `run`, memos, effects                                                     |
| guesses    |    80 | `guess`, `track`                                                                        |
| props      |    84 | `prop`, `spreadProps`                                                                   |
| handlers   |   300 | `handle`, `spread`, `callable`, merged handlers, `rpc`                                  |
| context    |   100 | contexts, globals, route                                                                |
| templates  |   477 | clone and its helpers                                                                   |
| branches   |   399 | `#if`, `#key`, `#try`, `#client`, `#offscreen`                                          |
| lists      |   449 | `#for`, windowed lists                                                                  |
| inserts    |   345 | text, attributes, `#portal`                                                             |
| components |   192 | child components, dynamic tags                                                          |
| page       |    51 | style variables, `#head`, `#portal`, stylesheets                                        |
| resume     |   427 | `init`, state records, `leavePage`                                                      |

The merge of handlers (`spread`, `callable`, `handlerProp`, `handle`, with `mergeHandlers` and `PARTS` from shared.ts) is together in handlers.ts.

## Deviations

- Not a pure move in 11 spots: a `let` that two modules write got a small function in its module (`treeChanged`, `resetIds`, `resetWrites`, `leaveGuesses`, `resetHandler`, `setHiding`, `setGuesses`, `markCloned`, `observeMarkers`, `stopObserving`, `configure`). `offscreen` and `guess` call a setter in place of `??=`. Behavior is the same.
- The module map differs from the contract (`call`, `resolve`, `fail` and `insertHTML`/`refresh` are not where v1 put them). See `contracts/client-modules.change-request.md`.
- No test was added or changed. The suite is the check.

## Stubs left

- None.

## Gotchas

- Add an import only from an earlier module in the order above, or lint fails with a cycle. If a function needs a later module, move it up or pass the value in.
- A `let` that another module must write needs a function in its own module. State that lower modules read goes in state.ts.
- Built chunks carry a `//#region` comment for each module, so the unminified chunk is larger.
- `dist` sizes of the unminified chunk are not the measure of the bench. Use the todos build.

## Proposed learnings

- A module of client/ imports only earlier modules of the order in client.ts | `import/no-cycle` is an error | packages/brumate/src/runtime/client | yes (oxlint)

## Verification

- `npx vitest run` in packages/brumate: 55 files, 972 passed, 5 expected fail (as before). `npx vitest run --maxWorkers=2` in packages/ui: 54 files, 505 passed.
- `npx tsc --noEmit -p .` in packages/brumate: no errors in src. `npx oxlint`: exit 0, fewer warnings than before in these files. `npx oxfmt --check`: pass.
- Not run: the ui typecheck (`brumate-tsc`), `node e2e/run.mjs`, `pnpm bench`.

## Size

Gzip -9, base then head.

- Unminified chunks of dist (`npx tsdown`): client 31113 to 31776 (+663, the `//#region` lines and setters), produce 4581 to 4581, client-routes 1818 to 1818.
- Same chunks minified with esbuild: client 15588 to 15640 (+52), produce 1974 to 1974.
- Todos app of benchmarks/brumate (`vite build`, all JS of dist/client): 27863 to 27773 (-90). Its core chunk is 9753 to 9663. Tree shaking drops the setters that the todos page does not use. `pnpm bench` itself was not run.

Estimated M, actual M.
