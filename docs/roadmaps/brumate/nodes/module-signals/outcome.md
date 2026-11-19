# Outcome: module-signals

## Built

- `packages/brumate/src/module-signals.ts`: the transform. `planModuleSignals` plans the edits for the top level of a program (a `.brm.ts` module or `<script module>`): `let x = $signal(v)` to `const x = store(v)`, `const y = $memo(expr)` to `derived([sources], ([sources]) => (expr))`, reads to `x.get()`, writes to `x.set(…)` (`=`, compound operators, `++` and `--`), `$produce(x, recipe)` to `x.set(produce(x.get(), recipe))`. `transformModuleSignals` gives the code of a module. `expandSignals` is the importer side for a component. `findModuleSignals` and `findSignalImports` serve the Vite plugin, the compiler and `brumate check`.
- Importer side: in `expand()` of `src/compile.ts`, after module functions are copied. A name imported from a `.brm.ts` module that is a signal or memo becomes `const name = $store(<store>)`. A signal of `<script module>` is stored as `$$ms_<name>`, and the instance script reads it as `let name = $store($$ms_name)` (`const` for a memo), so the script of the file can write it. The analyzer gets the names (`analyze(file, names)`) only to word BRM117.
- Vite: `src/vite.ts` runs `transformModuleSignals` for `.brm.ts` files (not the `?brumate-shared` query).
- Shared module: `src/shared-module.ts` does not share a site that reads a module signal of its module.
- Errors: BRM117 becomes `Cannot assign to {kind} "{name}"{hint}`, with the exported-function advice for a write through an import. BRM211 (top-level forms that cannot compile) and BRM208 (a module signal imported into a plain file, reported by `brumate check` in `src/check-command.ts`). Catalog entries in `src/error-catalog.ts`, pinned in `test/error-codes.json`.
- Tests: `packages/brumate/test/module-signals.test.ts` (11 tests), pages in `packages/brumate/test/module-signals/`.
- Docs: "Shared state at module level" in `website/docs/reactive-modules.md`, a pointer in `website/docs/state.md`, an entry in `docs/decisions.md`, `.changeset/module-signals.md` (minor).

## Proof

Not a fix node.

## Result

Not an experiment node.

## Deviations

- The top-level error is BRM211, not BRM207. BRM207 is `#reveal has no style of its own` (block-styles, already in the catalog and in `test/error-codes.json`). The brief reserved both 207 and 208. 209 and 210 belong to effect-copy-warning. The orchestrator must check that no other node of the batch took 211.
- Fix round 1 (review): imported signals in modules, writes by copied module functions, `.brm` imports of `<script module>` signals, transitive memo sources and destructuring writes are done, each with a test. `src/modules.ts` exports `scripts`.
- `packages/brumate/src/index.ts` exports `transformModuleSignals`, and `website/src/live/run.ts` calls it for `.brm.ts` files of a live sample. Without it the docs sample of the new section throws `$signal works only in .brm files`.
- Files outside the owned paths: `src/modules.ts` is not changed. `src/analyze.ts` (the name list and the BRM117 wording), `src/compile.ts`, `src/shared-module.ts`, `src/vite.ts`, `src/check-command.ts`, `src/error-catalog.ts`, `test/error-codes.json`, `website/docs/reactive-modules.md`, `website/docs/state.md`, `docs/decisions.md` and `.changeset/module-signals.md` are in the brief's shared list. Not in it: `website/docs/errors.md` and `packages/brumate/skills/brumate/references/errors.md`, which are generated from the catalog (`UPDATE_SKILL=1`) and tests compare them.
- The todos size was measured with `pnpm bench --only brumate --scenario todos` on the branch only (total JS after counter, toggle, add 33.2 kB raw / 13.8 kB gzip; client JS emitted 84.9 kB / 29.9 kB). No base run: a component without a module signal gets no edit from `expandSignals`, so its output is the same by construction.
- The virtual file of the language server was not changed. The original source is what TypeScript sees, so `count = count + 1` in the script of a file with `let count = $signal(0)` in `<script module>` type checks as it does for a script signal.

## Stubs left

None.

## Gotchas

- A module function that a component copies and that reads a module signal of its module is copied per component, not shared. The state stays shared, so this costs bytes only.
- A memo follows same-module functions and exported functions of other `.brm.ts` modules (`planModuleSignals`, `memoSources`). A helper in a cycle of imports, or one that a module cannot resolve, is BRM211 or not followed (a cycle is planned once).
- A signal of `<script module>` is exported as `export { $$ms_x as x }`, and a `.brm` import of it compiles like a `.brm.ts` import. A function of the module script is imported the same way.
- The tests import the compiled `.brm.ts` file directly, so they call `transformModuleSignals` themselves, as the Vite plugin does. The playground of the docs does the same (`website/src/live/run.ts`).
- `expandSignals` finds a `<script module>` signal that the rest of the file reads with a regular expression on the text outside the module script. A word in prose adds one unused `$store` read.
- BRM211 reads `{name} cannot be compiled in a module{reason}. {fix}` after fix round 1, since it now covers more than the top level.

## Proposed learnings

None.

## Verification

- `pnpm --filter brumate exec vitest run test/module-signals.test.ts test/check-command.test.ts test/skill.test.ts`: pass (107 tests).
- `pnpm --filter brumate exec vitest run test/stores`: see the full check below.
- `pnpm --filter website check:samples`: 71 samples, 0 problems.
- `pnpm exec oxlint`: no errors (warnings in the new test files for shadowed names). `pnpm format:check` and `pnpm typecheck`: pass.
- Full check `pnpm build && pnpm test && node e2e/run.mjs`: build passes. `pnpm test` at load average 30 had 15 timeout failures in `devtools`, `differential-1`, `feature-flags-off`, `inspect`, `packages`, `render`, `resume`, `search-params`, `testing` and `check-command`. Rerun alone, every file passed (`resume` 651 tests, six of the files 69 tests); `render` and `differential-1 refLoop` only timed out at 5 s and 10 s under load and were not rerun with longer limits. The e2e run had one failure that the change caused: the live sample of the new docs section, which the playground in `website/src/live/run.ts` ran without the transform. Fixed there. `node e2e/run.mjs --only website` then passed 75 of 75 (the `/docs` navigation failure of the first run did not repeat). The other suites passed in the first run.
- Size: `pnpm bench --only brumate --scenario todos` on the branch, numbers in Deviations.

## Size

- Estimated M, actual M. The transform was small. The importer side and the shared module needed the most care.
