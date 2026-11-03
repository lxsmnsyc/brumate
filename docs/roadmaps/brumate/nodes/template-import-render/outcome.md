# Outcome: template-import-render

## Built

- `componentNames` in packages/brumate/src/codegen/render.ts reads the templates of every block body (`bodyNames`), so the render module imports a component that only a `#template` inside a block renders.
- Tests in packages/brumate/test/resume.test.ts (`a #try around a #template`) and fixtures test/render/templateKid{Top,If,Key,For,Loading,Switch}.brm. Changeset .changeset/template-import-render.md (patch).

## Deviations

- None. The #try case fills the place of the render output with `b.place`, as the core does, and finds `.boom`. The client part (codegen/client.ts) has no gap: its scopes already include the templates, and the parts of all seven fixtures import TryKid.

## Gotchas

- Block bodies with the bug: `#try` (body and `#catch`), `#if`, `#switch`, `#for`, `#key`, `#loading`, plus the other blocks that componentNames visited (`#repeat`, `#client`, `#defer`, `#portal`, `#head`, `#offscreen`) by the same code path. A template outside any block was already right.

## Verification

- Six new cases failed before the fix and pass after. `pnpm build && pnpm typecheck && pnpm test` pass (2163 brumate tests); `pnpm lint && pnpm format:check` pass.
- Bench todos: JS before load 5 files, 32.4 kB / 13.6 kB gzip. Todos has no template in a block, so its output does not change.

## Size

- Estimated S, actual S.
