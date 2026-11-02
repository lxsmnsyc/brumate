# Outcome: try-template-call-site

## Built

- A runtime link `l` from a template scope to the scope where its output is inserted. `fail` in packages/brumate/src/runtime/client/errors.ts walks `l ?? p ?? o`, so the `#try` around the call catches.
- The output of a template names its scope: `raw(html, scope)` (packages/brumate/src/runtime/html.ts, codegen/markup.ts `emitTemplate`). Server `insert` records `l` in the page state; client `insert`, `write` and `TemplateCall` set it (`linkCalls` in runtime/client/children.ts). Resume reads it; `SCOPE_IDS` lists it.
- Client inserts that call a template or a function pass their scope (`callsTemplate` in codegen/markup.ts).
- `triesTable` in codegen/client.ts: each scope takes the entry of the nearest `#try` body above it, and stops at a template scope.
- `calledTemplates` in graph.ts (now private): templates called in the body, through other templates or functions, also when called outside too. Only `tryCatchesClient` uses it.
- Tests in packages/brumate/test/resume.test.ts, describe "a #try around a #template": call inside and outside (tryTemplateTwice), a top-level template in a `#try` in a `#for` (tryTemplateFor, tryTemplateBlock, tryTemplateFunction), a `#try` that the browser renders (tryTemplateIf, tryTemplatePropIf), a template prop that the child renders again (tryTemplatePropToggle). Changeset .changeset/try-template-call-site.md (patch).

## Removed

- The template part of #420's `triesTable`: template roots, the claim of a nested `#try`, the check that the template is declared in the scope that holds the block, and the distance map. The `calledOutside` exclusion of `calledTemplates`.

## Deviations

- The #420 test tryTemplateNested now expects the inner `#catch`; #420 kept it uncaught as a known gap.
- Edited the #420 bullet in website/docs/control-flow.md (not in the brief's paths), since it described the gap.

## Stubs left

- None.

## Gotchas

- A template's output links only when an insert renders it with a scope. Output that reaches the page another way keeps the declaring scope as the walk.
- A `#try` in a child that calls a template prop but has no client code of its own ships no `#catch`, so a `#try` further out catches.

## Verification

- On main 18 of the describe's 28 tests fail, on 71aed243 7 (plus tryTemplateFunction, found in review); all 28 pass on the branch.
- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (1372 passed).
- `pnpm bench --only brumate --scenario todos`: JS before `load` 14.9 kB gzip (main 14.8).

## Size

- Estimated M, actual M.
