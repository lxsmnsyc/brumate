# Outcome: template-update-in-place

## Built

- packages/brumate/src/codegen/markup.ts: in the browser, a template of the file that can update in place compiles to a wrapper that returns `$$b.templateCall(...)` and the old body as `name$`.
- packages/brumate/src/codegen/scopes.ts: `templateArgs`, the parameters and `[slot, value]` pairs of a template.
- packages/brumate/src/codegen/client.ts: `emitTemplateExports` emits `T<id>a` and `T<id>k` for each template of the file; `emitTemplateArgs` uses `templateArgs`.
- packages/brumate/src/runtime/client/children.ts: `templateCall`, a `lexical` flag of `TemplateCall`, and `insert()` renders a list of calls (each is replaced at an update, not updated in place).
- packages/brumate/src/runtime/client/inserts.ts: `renderedTemplate` also matches the scope that the server linked to the insert (`scope.l`) when its anchor is in the range of the insert; `write()` destroys the scope of the template that it replaces.
- Tests in packages/brumate/test/resume.test.ts with test/render/tplInPlace.brm, tplInPlaceHost.brm, TplInPlaceList.brm: server-rendered rows keep the input node, focus and value across updates; browser-rendered keyed rows keep them across an update and a reorder; a template switches to another at the same insert; a list of calls updates; scope counts stay flat. The first fails on the base.
- Snapshots list.txt and template-update.txt gain the `T2a`/`T2k` exports and the wrapper.
- .changeset/template-update-in-place.md (patch).

## Deviations

- The brief says `write()` takes the in-place path when the same template renders again. It already did for a `TemplateCall`; the change is in what a template of the file returns, not in `write()`.
- The cleanup test of template-component-import (`once for each replaced row`) now expects no cleanup and the same nodes, as no row is replaced.

## Stubs left

- None.

## Gotchas

- A template with a default value in a destructured parameter still renders again (old behavior).
- A list of template calls is replaced at each update.
- A server-rendered template that only renders a component, replaced by another at the first write, keeps its scope (no node names it).

## Proposed learnings

- None.

## Verification

- Exit 0: packages/brumate (2827 tests, `--hookTimeout=120000 --maxWorkers=3`), tsc, language-server, vscode, ui, and the examples hackernews, kit-app, nitro, todos, tracker, ui-kit; ui e2e (55 passed); root oxlint; oxfmt --check on changed files; brumate typecheck.
- New tests fail on b5fdff93 (the probe, two calls at one scope, unread parameter, scope leak of the swap).

## Size

- Estimated M, actual M.
- Client gzip (sum of dist/client/**/*.js, gzip -9), clean rebuilds of b5fdff93 and the head: todos 39,239 to 39,222 B (-17), ui 199,070 to 199,303 B (+233).
