# Outcome: produce-map-set

## Built

- Step 1: `produce(base, recipe, name?)` in `packages/brumate/src/runtime/produce.ts` warns in dev, once for each name: `$produce(<name>) changed a <ClassName> and returned nothing. Nothing updates. Return a new value, such as new <ClassName>(<name>).`. The compiler passes the name in dev only (`codegen/patch.ts`, `rewrite.ts`, `client.ts`, `render.ts`, `server.ts`; new `Patch.appendArgument`). Commit 7ffcc76f.
- Step 2: `packages/brumate/src/runtime/produce-collections.ts` drafts `Map` and `Set` (as a signal value, inside a drafted object, array, map or set). Copy on the first write, entry order kept, values drafted on read, keys never drafted (`TypeError` in dev for a draft key), the same map or set returned when nothing changes. Instances of other classes and subclasses of `Map` and `Set` stay as they are and warn. Commit 17e657e1.
- Docs: `website/docs/state.md`, `website/docs/reference-signals.md`, `docs/decisions.md`. Changeset `.changeset/produce-map-set.md` (minor).

## Proof

Not a fix node.

## Result

Not an experiment node.

## Deviations

- `packages/brumate/src/codegen/{patch,rewrite,client,render,server}.ts` edited (not owned) to pass the name of the signal. `website/docs/reference-signals.md` edited besides `signals.md`: the brief names `website/docs/signals.md`, which does not exist; the pages are `state.md` and `reference-signals.md`.
- Tests added to `render.test.ts`, `features.test.ts`, `resume.test.ts`, with `test/render/produceMap.brm` and its snapshot, and `render/produce.txt` updated. The brief names `test/client/`, which does not exist.
- `shared-module.ts` is not changed: module-level `$produce` has no dev flag and warns without the name.
- The brief's guard idea (`instanceof Map` calls into a separate module that the bundler drops) was not tried: the check is at run time, so the module is reachable from `produce`.

## Stubs left

- None.

## Gotchas

- `import.meta.env?.DEV` only works in that literal form for `vi.stubEnv` (see log).
- A new fixture in `test/render/` needs an entry in `render.test.ts` props and in `features.test.ts`.
- The dev compile of every `$produce` call changed (a third argument), so snapshots with `$produce` change.
- A returned Set that holds drafts is rebuilt in place.

## Proposed learnings

- Write the dev check as the literal `import.meta.env?.DEV` | tests can stub it only in that form | packages/brumate/src/runtime | no

## Verification

- `pnpm lint` (no new warnings in the files), `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm --filter brumate exec vitest run test/produce.test.ts`: 28 passed.
- `pnpm build && pnpm test`: 64 failures in 8 files under load (timeouts); the 8 files pass alone, 1282 tests. `node e2e/run.mjs`: pass.
- `pnpm bench --only brumate --scenario todos`, branch and base 8cebc3ae: identical. Client JS emitted 84.9 kB / 29.9 kB gzip; total JS after counter, toggle, add 33.2 kB / 13.8 kB. Todos does not call `$produce`: 0 bytes.
- A page that calls `$produce` (esbuild bundle of `produce.ts`, minified, `import.meta.env` undefined): 1787 B / 806 B gzip before, 4701 B / 1769 B gzip after: +2.9 kB raw, +0.96 kB gzip. The collections code is reachable from `produce`, so object-only pages pay it too.

## Size

- Estimated M, actual M.
