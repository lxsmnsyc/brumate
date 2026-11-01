---
id: prune-lazy-parts
title: Remove the code-part loading left from lazy loading
status: todo
priority: should
type: refactor
outline: false
milestone: 0.5.0
target:
from:
size: M
spike: false
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-01
owns: []
shared:
  - packages/brumate/src/runtime/client/code.ts
  - packages/brumate/src/runtime/client/state.ts
  - packages/brumate/src/runtime/client/updates.ts
  - packages/brumate/src/runtime/boot.ts
  - packages/brumate/src/codegen/client.ts
reserves: []
provides: []
depends_on:
  - on: next-branch
    kind: hard
    why: minor work targets next
---

# Remove the code-part loading left from lazy loading

## Goal

Since all of a page's code loads at start (2026-10), a module never loads its parts one by one. The machinery for it still ships on every page and adds an `await` to each handler and update. Remove it.

## Context

Found by two separate audits on 2026-11-01 (session scratchpad, not in the repo):

- The compiler never emits `load`: codegen/client.ts (about lines 284-326) inlines the code or emits `export * from` the parts, and vite.ts bundles modules as plain objects. So `loadPart(module, name)` always resolves to the module itself.
- Dead with it: `ClientModule.load`, `CoreOptions.loadPart`, `Part`, `parts`, `loadedParts`, `getPart` (state.ts), `loadPart` and the slow path of `loadedFunction` (code.ts), boot.ts `partLoads`/`loadPart` and the `loadPart` passed to `init`, the compile result's `loaders` (compile.ts, codegen/client.ts), and `updateReady`, `loadUpdate`, `updateCode` (updates.ts) with the `export const w = [...]` that the compiler emits for them.
- Call sites switch to the module: branches.ts, errors.ts, insert.ts, references.ts, rpc.ts, resume.ts `forget`, client.ts. `loadedParts.has(id:update)` fast paths become `modules.has(id)`.
- Keep `trigger`'s slow path for writes before code loads (navigation, `#defer`), as "await `loadModule` of the roots, `loadingCode` and `childrenReady`, then one pass". Keep `codeReady`, `loadingCode`, `loadingUpdates` and `childrenReady`: navigation, `#defer`, `updated()` and `$resolve` need them.
- Measured on trimmed copies: about -855 B min / -304 B gzip in the core, plus the loader's map (about 250 B min, guess) and the `w` exports in app modules.
- test/resume.test.ts `describe('a handler waits only for')` (about 7175-7276) is the only user of module `load`; rewrite or remove it. hot.test.ts and resume.test.ts fixtures fake `load`.

## Acceptance

- [ ] No `loadPart`, `parts`, `loadedParts`, `getPart`, `ClientModule.load`, `updateReady` or emitted `w` remain.
- [ ] A failed module load still reaches `fail` and the nearest `#catch`.
- [ ] Full check passes (`pnpm build && pnpm test && node e2e/run.mjs`).
- [ ] `pnpm bench` todos client JS gzip recorded against next; expected about -0.3 kB.
- [ ] Changeset (patch: no API change).

## Sizing

M: a wide but mechanical edit across about 12 files.
