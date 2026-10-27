# Outcome: component-tag-spread

## Built

- A live spread and a computed attribute on a dynamic tag that names a component reach the component. A live handler already did on main (see Gotchas).
- `packages/brumate/src/project.ts`: `dynamicTags` and the dynamic branch of `summarize` count every kind of attribute that is live, not only `value` ones. A spread or a computed attribute gives the target the live prop `~` (`tagProp`), which means every prop but `children`. `declaresProp` accepts `~` for any component that declares a prop.
- `packages/brumate/src/graph.ts` (`isLiveProp`): `~` makes each prop live except `children`. `*` (a spread onto a static component) is unchanged.
- `packages/brumate/src/runtime/client/inserts.ts`: `attrs` passes the merged attributes to `spreadProps` when the anchor is a component. `props.ts` (`spreadProps`) skips `b-` names, such as the `b-on` that a dynamic tag adds for its handlers.
- `packages/brumate/src/codegen/client.ts`: a computed attribute whose name or value can change gets an update, as a spread has. It goes through `attrs` as an object (`{ [name]: value }`) merged with the other attributes of the element in their order. New helpers `computedCode`, `valueCode`, `rewrittenCode`; `spreadCode` also returns the code of computed attributes. This also fixes `[name]=(value)` on plain elements, which was the compile error "This attribute cannot change on the client yet". A computed attribute on a static component (`<Comp [name]=(x)>`) still gives that error.
- Tests: `resume.test.ts`, describe "a spread on a component tag" (fixtures `tagSpreadSpread`, `tagSpreadHandler`, `tagSpreadComputed`, `tagSpreadLabel`, `tagSpreadRest`). The ToggleButton test of `packages/ui/test/as-controls.test.ts` is `it` now.
- Changeset `.changeset/component-tag-spread.md` (brumate, patch).

## Deviations

- Edited outside the owned paths: `packages/brumate/src/graph.ts` (one line, the `~` prop). The brief lists project.ts, codegen/markup.ts and runtime/client as shared. codegen/markup.ts was not needed; `codegen/client.ts` was (computed attributes).
- The handler test passes on main, so one of the three acceptance tests does not fail there. It stays as a guard.
- As the brief allows, the first plan (a plain `*` for the spread) was tried and failed as as-passed-on said; see Gotchas.

## Stubs left

- None.

## Gotchas

- Why `~` and not `*`: `*` makes `children` of the target live, so a write to the target waits for the code of its children. The Tabs `check()` in packages/ui reads the DOM in a microtask after a selection, and the second tab's `aria-selected` then arrived after it, so the selection went back to the first tab (as-collections tests "moves between tabs" and "updates the attributes that a part gives to a component in as"). That is the load-time race that ordered-updates noted. Leaving `children` out keeps the write synchronous. If a later node removes the race (batching), `~` could become `*`.
- A computed attribute on an element with a spread merges into the same `$$b.spread` call on the server, so a rename removes the old attribute (the reviewer checked).
- A computed attribute whose name or value has no code in the browser (a plain `const`, a signal that nothing writes) keeps the compile error "This attribute cannot change on the client yet", for the computed attribute itself and for any spread or computed attribute next to it, since an update without it would remove the attribute. Tests: project.test.ts (rename-only) and resume.test.ts ("keeps a computed attribute when only the spread next to it changes").
- `spreadProps` skips `b-` names for all callers. The other callers are spreads onto static components; `b-` names are reserved for brumate, so no prop uses them. `attrs` passes `[]` as `after` and ignores `own` for a component: the merged object is already in source order, and `own` names element attributes only.
- `inspect.ts` looks up `~` too, so the diagnostic names the parent of a prop that a dynamic tag's spread makes live.
- Analysis of packages/ui: only `test/fixtures/AsTarget.brm` gets a new live prop (`~`).

## Proposed learnings

- A prop that is live for every key must leave `children` out, or the writes to the component wait for the code of its children | the wait reorders updates against microtask checks | packages/brumate/src | no

## Verification

- `pnpm --filter brumate exec vitest run test/resume.test.ts -t "spread on a component tag"`: the spread and computed tests fail on main (a time-out of the `waitFor`, and a compile error), pass now. The handler test passes on both.
- `npx vitest run` in packages/brumate after `pnpm build`: all pass except `vite.test.ts` before the build, and the "stops updates that keep writing what they read" test once under load (passes alone).
- `npx vitest run --maxWorkers=2` in packages/ui: 537 passed, 1 expected fail (the ToastRegion test of spread-children-live).
- `pnpm lint` (warnings only), `pnpm format:check` and `pnpm typecheck`: pass.
- Not run: `node e2e/run.mjs`, the full `pnpm bench`.

## Size

- Todos of benchmarks/brumate (`vite build --outDir dist/client`, all JS of dist/client concatenated, gzip -9): 26372 on main to 26391 with the change, +19 B, within 0.1 kB. `pnpm bench` was not run.
- After the review fixes, `pnpm bench --only brumate --scenario todos --metrics dist`: 28184 B gzip (the reviewer measured main 28191 and the first head 28189 with the same command).
- Estimated M, actual M.
