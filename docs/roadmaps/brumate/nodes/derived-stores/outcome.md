# Outcome: derived-stores

## Built

- `derived(sources, fn, initial?)` in `packages/brumate/src/runtime/store.ts` (`brumate/store`), with the types `Stores` and `StoresValues`. It returns a `StoreLike<T>` with no `set`. The two forms are typed as overloads (`(values, set, update)` first, as in Svelte's JSDoc).
- A source and a derived store that reads it compute `fn` once per change. A store that hears a source adds a trailing listener to the source's listener set; the waiting stores then compute by depth. `sendStore` is unchanged.
- Tests: `packages/brumate/test/stores/derived.test.ts` (22 tests: forms, subscribers, updates, foreign stores, and a render test), fixtures in `packages/brumate/test/stores/derived/`. The render test covers a server render, no listener left on `cart` after it, resume, a source change and a click.
- Docs: "Derived stores" in `website/docs/context.md` (after "Live values with stores"), a one-line pointer in `website/docs/state.md`, a `derived` entry in `website/docs/reference-signals.md`, an entry in `docs/decisions.md`, `.changeset/derived-stores.md` (minor).
- Svelte comparison, in `log.md`: every form matches except equality (`Object.is`), no call at subscribe time (store contract), and the diamond (Svelte 4.2.18 runs `fn` three times with a stale value; brumate once).

## Proof

Not a fix node.

## Result

Not an experiment node.

## Deviations

- New fixtures under `packages/brumate/test/stores/derived/` (`sources.ts`, `derivedReader.brm`), outside the brief's owned paths. They need their own folder so `stores.test.ts` does not compile them.
- The size check used a bundle of `dist/runtime/store.js` with esbuild, not `pnpm bench --only brumate --scenario todos` (not run; the todos app imports no `derived` and `sendStore` is unchanged). Numbers below.

## Stubs left

None.

## Gotchas

- A derived store is a foreign store (`get` and `subscribe`, not a `Store`). `$store` reads it from an import; in a provided value or prop the server refuses it.
- Review fixes: a `fn` that throws on the first subscribe leaves the store stopped (it can start again); a throw in a flush clears the other waiting stores; a late async `set` keeps its value.
- A source that is not a `Store` (no listener set) makes the derived store compute at once, so a diamond over two stores of another library is not glitch-free.
- A test that resets the module registry (`vi.resetModules()` in the loader) gets a new copy of a module-level store; import the store again after `start`.

## Proposed learnings

None.

## Verification

- `pnpm --filter brumate exec vitest run test/stores`: 3 files, 100 tests pass.
- Full brumate vitest (`--maxWorkers=2`): 3223 pass, 1 fail (`resume.test.ts` "defines ..." in a loop of the handler-refs tests) under load; `-t defines` alone: 8 pass. Not related to this change.
- `pnpm --filter website check:samples`: 70 samples, 0 problems.
- `pnpm exec oxlint`: no errors, none from the new files. `pnpm format:check` and `pnpm typecheck`: pass.
- Size (esbuild, minified, gzip): `store` + `sendStore` 335 B on the base, 334 B now; with `derived` 929 B, so `derived` adds 595 B.

## Size

- Estimated S, actual S.
