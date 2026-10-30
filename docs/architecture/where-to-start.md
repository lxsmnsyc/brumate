# Where to start

Each section lists the files to touch and the tests to update for one common change. Back to the [overview](../architecture.md). Paths are from the repo root. Before any of these, check [decisions.md](../decisions.md) for a decision that rules the change out, and the [roadmap](../roadmaps/brumate/GOAL.md) for a node that already owns it.

For any change, finish with the fast check: `pnpm lint && pnpm format:check && pnpm typecheck`, then the tests named below. A change users can see also needs a changeset.

## Add a compile error

1. Find where the stage reports problems. The parser reports syntax errors (`packages/brumate/src/parser.ts`). `analyze.ts` reports scope and signal rules. `graph.ts`, `plan.ts`, `captures.ts`, `env-check.ts` and `pending-reads.ts` report the rest. Reuse the way a neighbor reports its error.
2. Add the entry to `packages/brumate/src/error-catalog.ts` with a message, a cause and a fix. Take the next code that was never used. Never change or reuse a code.
3. Pin the code. Run `UPDATE_SKILL=1 npx vitest run test/check-command.test.ts` in `packages/brumate`. This updates `packages/brumate/test/error-codes.json`.
4. Regenerate the skill's error list the same way with `test/skill.test.ts`. It rewrites `packages/brumate/skills/brumate/references/errors.md`.
5. Add the explanation with an anchor to `website/docs/errors.md`. `check-command.test.ts` checks that the page has every code.
6. Add a test with the smallest `.brm` source that triggers the error, in `packages/brumate/test/diagnostics.test.ts` or the test file of the stage. A change to a fixture changes snapshots in `test/__snapshots__`, so review those diffs.

## Change code generation

1. Find the output you change. The server module is `codegen/server.ts` and `codegen/markup.ts`. The client modules are `codegen/client.ts`, `codegen/rewrite.ts`, `codegen/scopes.ts` and `codegen/template.ts`. The render module is `codegen/render.ts`.
2. If the change needs new facts, add them to the plan in `plan.ts` and the graph in `graph.ts`, and document them in [ir.md](../ir.md).
3. Update the tests. `packages/brumate/test/codegen.test.ts`, `render.test.ts` and `template.test.ts` compare generated modules, HTML and state with snapshots. Add a `.brm` file to `packages/brumate/test/render` for a new case. `resume.test.ts` checks that the page still resumes and updates after an event. Review every snapshot diff by hand. A diff you cannot explain is a bug.
4. If the page format changes (state records, `g` tables, markers), the server and client must still agree. Check the client reader in `runtime/client/resume.ts` and [page-format](../../website/docs/page-format.md).
5. Measure the size. Run `pnpm bench` alone, and report the gzip size of `todos`. See [performance.md](../performance.md).
6. Run `pnpm test`, then `pnpm e2e` before the pull request leaves draft, since the unit tests run in happy-dom.

## Add a runtime helper

A helper is a function that compiled code calls.

1. Server side: add the export to `packages/brumate/src/runtime/server.ts` (or a module it re-exports). Compiled server modules call it as `$$b.<name>`.
2. Client side: add the helper as an export of its own in the `client/*` module for its feature, and re-export it from `packages/brumate/src/runtime/client.ts`. Respect the import order in the header of that file, so there are no cycles.
3. Emit the call from the matching generator in `packages/brumate/src/codegen`.
4. If only some pages use it, add a build flag in `src/runtime/features.ts` and `src/features.ts` so the client build drops it when no component uses it. A test in `test/feature-flags.test.ts` and `test/features.test.ts` covers the flags.
5. Add a unit test in `packages/brumate/test/runtime-helpers.test.ts` or a render test as above.
6. A public function for apps goes in a module with an entry in `package.json` `exports` and in `tsdown.config.ts`. Add its alias to `packages/brumate/vitest.config.ts` and `packages/ui/vitest.config.ts`.
7. Check the size with `pnpm bench`. The core has a budget.

## Add a part to @brumate/ui

Each part has a source file, a test, a docs page, a demo and a card.

1. Source: `packages/ui/src/<Part>.brm`. Export `<Part>OwnProps` or `<Part>Props` from `<script module>`, since the props table of the docs reads it. Shared logic goes in `.brm.ts` modules and `.ts` files in the same folder. Look at `Button.brm` for the shape.
2. Stories for the workbench, optional: `packages/ui/src/<Part>.stories.ts`.
3. Test: `packages/ui/test/<Part>.test.ts` with fixtures in `packages/ui/test/fixtures`. Render with `mount` from `virtual:brumate/testing` and press with the helpers in `packages/ui/test/interact.ts`. `client-part-imports.test.ts` checks every part automatically.
4. Docs page: `website/ui/<part>.md`. Use a section order that `website/plugins/props-table.ts` accepts. Follow the page of a similar part.
5. Demos: `website/ui/demos/<Part>Demo.brm`, and more demos named by the page.
6. Sidebar: add the page name to a group in `website/src/ui.ts`.
7. Card: add an entry with `title`, `summary`, `href` and `demo` to `gallery` in `website/src/ui.ts`.
8. Run `pnpm --filter @brumate/ui test`, `pnpm --filter website check:samples`, `pnpm --filter website test` and `pnpm --filter website build`. Then `pnpm e2e --only ui,website`.
9. Add a changeset for `@brumate/ui`.

## Add a docs page

There are two kinds of docs. Do not mix them.

- **User docs** are website pages: `website/docs/*.md` for brumate and `website/ui/*.md` for `@brumate/ui`. Add the page name to a group in `website/src/docs.ts` (or `website/src/ui.ts`), and a short label if the title is long. A fenced `brm` block with `live` shows a running sample. Run `pnpm --filter website check:samples`, then build the site.
- **Internal docs** are files in `docs/`, such as this guide. They are not in the site and CI skips them. Write them with the plain-writing skill and link the existing documents instead of repeating them.

## Other changes

| Change                              | Start at                                                                                                                | Tests                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| New syntax                          | [decisions.md](../decisions.md), [grammar.md](../grammar.md), then `parser.ts`. Syntax proposals need a decision first. | `parser.test.ts`, fixtures, `highlight.test.ts` and `highlight-keywords.ts`. |
| Editor behavior                     | `check.ts` for types and mappings. `packages/language-core` for the plugin.                                             | `check.test.ts`, `packages/tsc/test`, `packages/language-server/test`.       |
| Vite plugin option                  | `BrumateOptions` in `vite.ts`. Document it in `website/docs/reference-plugin.md`.                                       | `vite.test.ts`, `vite-app/`.                                                 |
| Server function, form or cache rule | `runtime/server.ts`, `runtime/request.ts` and the file for the feature.                                                 | The matching `*.test.ts` in `packages/brumate/test`.                         |
| Devtools panel                      | `runtime/devtools-panel.ts`, and `src/inspect.ts` for data.                                                             | `devtools.test.ts`.                                                          |
