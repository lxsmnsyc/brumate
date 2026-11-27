# Outcome: docs-audit

## Built

Every page of `website/docs`, the guide pages of `website/ui`, the package READMEs, the root README and the brumate skill were read against the code of `batch/brumate-release-0.10` (equal to `release/0.10`). Wrong text was fixed in place. Code gaps are listed under Findings, with no code edit.

- Each page of `website/docs` (but `errors.md`, see Checker) has a `type:` front matter line: `index` for the introduction, `tutorial` for getting started and the first app, `reference` for `reference-*.md`, `internals` for the five internals pages, `concept` for the rest. The site already reads front matter with `splitFrontMatter` (markdown, search and llms plugins), so nothing renders it.
- Each concept and reference page ends with a `## Related` list, each internals page has an `## Overview` after its lead, and both tutorials have `## Before you start` and `## Next steps` (renamed from `## Next`; no page linked `#next`).
- Output blocks and file trees with no fence language are fenced as `text`.

## Per page: checked and changed

### Start and components

- `index.md`: the resume model and click flow. No change.
- `getting-started.md`: commands `brumate-tsc --noEmit`, `brumate check`, `brumate skill` (`packages/brumate/src/cli.ts`, `packages/tsc`), Node engines (`>=22`; the page keeps 22.18 for type stripping), the dev server. Added Before you start; says a production build builds the client first, because the server build reads its manifest.
- `tutorial.md`: samples and API names. Added Before you start, Next steps.
- `components.md`: `$props`, `$bind`, `Bindable`, `$isPassed`, `$isBound`, `$handler`, `$untrack`, BRM027, BRM115, BRM217. BRM115 lists every case of the catalog. The line "a child cannot write a prop" contradicted the `let` and `$bind` section; fixed. Added BRM217 under children and the scope of each place that shows a `#template` call, and its throw into `#try`.
- `what-runs-where.md`: client roots and the table of what ships. No content change.
- `markup.md`: `brumate/events` exports (`prevent`, `stop`, `once`, `capture`, `transition`, `cancelWhen`), `Mod+` keys, `raw`, `a11y`, `viewTransition`. Added the rule for printed raw HTML of 256 characters or more.
- `styles.md`: `b-c-<hash>`, `--s-<hash>-<n>-<k>`, the 4 s stylesheet wait (`runtime/sheets.ts`), `preprocessCSS`. Added the stylesheets of `#defer` bodies.
- `editor.md`: `packages/vscode` contributions, the WASM parser, language-server diagnostics with BRM links, the `img` alt warning. Says diagnostics link to Compile errors and that `brumate skill` also copies the skills of installed `@brumate/*` packages (`findPackageSkills`).
- `typescript.md`: `brumate check --json` and `--no-types`, the JSON record fields, `typescript-api` 6.0.3, `ElementEvents`, `ElementEventNames`, `ElementProps`, `Markup`, `Component`, `PropsOf`, `@brumate/ui/as.ts`. No content change.

### Reactivity

- `state.md`: `$signal`, `$memo`, `$gate`, `$produce`, `$untrack`, `flush`, the error texts, the 10000-round limit. No content change.
- `control-flow.md`: `#template`, `#try`, `#client`, `#loading`, `#defer`, `#head`. Added: a `#template` body runs once per place that shows its call, and a kept call updates every place after resume.
- `effects.md`: `$effect`, cleanups, `asyncEffect`, BRM187, BRM209, `brumate:error` with `{ error, scope }`, the loader's `onError`, `$client` triggers. No content change.
- `context.md`: `createContext`, the no-provider error, `$getContext` with a fallback, `$store`, `$toStore`, `bridge`, `derived`, BRM196 to BRM200. No content change.
- `reactive-modules.md`: the module-level forms table and BRM085 to BRM092, BRM117, BRM120, BRM161, BRM182, BRM202, BRM203, BRM208, BRM211. No content change.
- `reference-signals.md`: every export of `runtime/signals.ts` and the `MACROS` set. Added the missing `$searchParam` row. `$bind` returns `BoundSignal<T>`. `$store` left the table of names that are not supported (it is a live function); `$hasContext` joined it (`analyze.ts` `OPTIONAL_FORM`).
- `reference-blocks.md`: blocks, inserts, attributes, events, reserved attributes. Added BRM217 under `#defer`, and that `{row(3)}` renders once for each place that shows it.

### Pages and data

- `routing.md`: route files, params, layouts, `@` slots, `_error`, `setStatus`, `_loading`, endpoints (405 with `Allow`, `HEAD`), `defineMiddleware`, `onError`, `onTrace`, `Locals`, `cache` (`maxAge`, `staleWhileRevalidate`, `x-brumate-cache`), `href`, `handle`. Serving routes now says `vite dev` serves the pages without `server.ts`, sets `appType: 'custom'`, and does not serve them with `middlewareMode`, Nitro, `spa` or `mpa`; the default script tags carry the nonce; a `scripts` you pass wins; `handle` takes `RouteOptions`. The kept-page nonce bullets became one, without the "from 0.9.1" wording.
- `navigation.md`: `data-prefetch`, `data-reload`, `data-rerun`, `inline`, `trigger`, `navigate` and `NavigateOptions`, `$route`, `$searchParam` options, `$navigation`, `data-navigating`, `brumate-announce`, transition types, `viewTransitionName`. No content change.
- `page-metadata.md`: `#head`, `<title>`, the `$title` warning (`analyze.ts`). No content change.
- `server-functions.md`: `'use server'`, `parse`, `safeParse`, `ValidationError` (300 characters), `ServerError`, `getEvent`, cookies, `createSession` (32-character secret, 7 days), `cached` (`maxAge`, `tags`, `name`, 1000 entries), `batched` (`key`, `limit`, `wait`), `toNodeHeaders`. Fixed: a `'use server'` file may export `middleware` too (`server-files.ts`).
- `async-data.md`: `$memo`, `#loading`, `#reveal`, `$isPending`, `$resolve`, `$debounced`, `$throttled`, `event.refresh`, `gather`, `inOrder`, `#defer`, BRM182, BRM188, BRM217. Added the stylesheet rule of `#defer` bodies.
- `forms.md`: `$action`, `parseForm`, `fieldErrors`, `createForm`, `parseSubmission`, `reply`, `__intent`, the 999 index and 1000-item limits, `idempotent` (600 s), `$optimistic`, `redirect`. No content change.
- `reference-routes.md`: the file table, matching, props, endpoints, middleware, `onError`, `ServerErrorInfo`. No change.
- `reference-serialization.md`: seroval plugins, `definePlugin`, `SendableValues`, `plugins`, `depthLimit`, `disabledFeatures`, the printed raw HTML rules (`PRINTED_MIN` in `runtime/server.ts`, `NOT_PRINTABLE` and `PRINTABLE_PARENTS` in `codegen/markup.ts`). Added the `ImageData` row; the parent list and excluded ancestors now match the code.

### Production

- `deploying.md`: `vite.ts`, `routes.ts`, `prerender.ts`, `builds.ts`, `RouteOptions`, `DocumentOptions`, the Nitro entry, `toNodeHandler` of `srvx/node`, early hints, prerender in Nitro, the shell, `.brumate/prerender.json`, `build.json`, `builds.json`, `hints.json`, `skew.keep`, `BRUMATE_BUILD`. Added `.vite/manifest.json` (on unless `build.manifest` is set), the build failure that says "Build the client first", dev scripts that follow `base`, the request nonce on kept pages, shell `#defer` bodies that wait for stylesheets, and `hints.json` in a build of several environments.
- `reference-plugin.md`: every option of `BrumateOptions`, `PrerenderOptions`, `Budget`; the `brumate` commands in `cli.ts`; the `compile` options; the exports of `src/index.ts`. Added `analyzeProjectDefers(files)` and `BrowserDefer`; `.vite/manifest.json` on the `clientOutDir` row; `brumate skill` copies the skills of `@brumate/*` packages.
- `packages.md`: `PACKAGE_FORMAT` 1, `dir`, the `exports` conditions, the dependency walk (`packages.ts`). `dir` can be a list.
- `environment.md`: `defineEnv`, `source`, Standard Schema, the async error, the missing and invalid messages (`runtime/env.ts`, `env-file.ts`). No content change.
- `reference-server.md`: `package.json` exports, `runtime/server.ts`, `request.ts`, `cache.ts`, `cookies.ts`, `rate-limit.ts`, `idempotent.ts`, `routes.ts`, `boot.ts`, `testing.ts`, `types.d.ts`. The module table lists every public subpath. `RenderOptions` gained `event`, `params`, `address`, `prerender`, `onError`, `onTrace`, `defer`, `linked`, `dev`, `printed`. Fixed: a server build that uses the routes fails without the client manifest (the page said it warned). New tables for `RouteOptions` and `RequestOptions`, and a `virtual:brumate/routes` section. Added `createSession` `cookie`, `PageCache.staleWhileRevalidate`, `ServerErrorHandler`, `ServerErrorInfo`, `TraceHandler`, `TraceSpan`, `TraceName`, the loader's `onError`, `onTrace`, `build`, `serial`, `navigate`'s `focus`, testing's `visit`, `createVisit`, `reveal`, `checkAccessibility`, `offscreen`. The stop function of `start` now says what it ends.
- `reference-security.md`: `isCrossSite` (Origin, `Sec-Fetch-Site`, `X-Forwarded-Host`, `origins`), `readAction`, the nonce paths, the `brumate` trusted types policy, `ServerError` messages, the `__proto__` refusal in `forms.ts`. `handle` sends scripts when you pass none; `scripts: ''` stays as given; the shell nonce; a page that holds its nonce in a meta policy, script text or a header is not kept. The version wording on the kept-page nonce is gone, because the fix may ship in 0.9.1 from main or in 0.10.0.
- `security.md`: rate limits against `rate-limit.ts` (sliding window, `strict`, proxies and `X-Forwarded-For`, the production throw, `enabled`, the prerender exemption). No content change.
- `observability.md`: `trace.ts`, `trace-browser.ts`, `otel.ts`, span names and attributes, `TraceSpan`, the 60 s and 10,000 limits, the `trace` option. Added `otel({ api })`, the throw once for a missing package, and that `render` and `handleRoute` take `onTrace`.

### Tools and internals

- `testing.md`, `testing-server.md`: `mount`, `visit`, `answerCalls`, `?brumate-server`, `Actions` (2000 ms `waitFor`), `offscreen`, `cookies`, `headers`, `url`, `status`, `close`, `checkAccessibility` rule sets and `rules`, `onCall`, the `/_brumate` prefix. No content change.
- `inspect.md`: `--json`, the report sections, `Budget` keys and error text, `report`, `devtools`, Alt+Shift+D, the button labels, `/__brumate/workbench`, `.stories.ts`. No content change.
- `reactive-graph.md`: export names, `analyzeProject`, the codegen pipeline. Added Overview, the `T<n>` export, the scope per place of a `#template` call, and the `#try` row for the catch body and error table.
- `page-format.md`: added Overview; a section on printed raw HTML (`<!--d…-->` markers, `$b.d`, the reader that fills `self.$bP`, the 256-character minimum, `readPrinted`); the `#loading` swap that waits up to 4 s for stylesheets; the `#defer` answer with the holder's style; `T<n>` and template scopes; `brumate/children` and `$b.d` in the plugin table; attributes `b-load`, `b-fail`, `b-catch`, `b-html`, `b-near`, `b-r`.
- `server-protocol.md`: headers `x-brumate-args`, `-redirect`, `-refresh`, `-result`, `-build`, `__action`, `__build`, `file<n>`, 204, 403, the 64 MiB frame limit, 409. Added Overview and the `#defer` request headers.
- `style-compilation.md`: `b-c-<hash>`, `--s-<hash>-<n>`, `b-style`, `b-v` (`css.ts`, `html.ts`, `server.ts`). Added Overview, the block style names, the build output, the stylesheet waits.
- `client-modules.md`: added Overview. "When the page starts" says `handle` writes the script tag: in dev the Vite client and the app's client entry or `virtual:brumate/start`, with `base`; in a build the manifest entry; the server build fails without the manifest; `clientOutDir`; the nonce; a `scripts` you pass wins. Modulepreload and early hints, and the SVG namespace of a component that starts with an ambiguous element.

### READMEs, skill, ui guides

- `README.md`: page code loads when the page starts (it said on the event); `vite dev` serves pages; Nitro or a server of your own; the branch policy is `release/<x.y>`, not `next`; the benchmark list.
- `packages/brumate/README.md`: client code is split into parts bundled per route and layout (not per handler); the `check`, `inspect` and `skill` commands.
- `packages/language-server/README.md`: it gives compiler diagnostics and CSS, SCSS and Less service, not TypeScript features; the `brumate-language-server` bin.
- `packages/typescript-plugin/README.md`, `packages/tsc/README.md`, `packages/vscode/README.md`: TypeScript 5.0 to 6, the TS 6 compiler, BRM codes on syntax errors. `packages/language-core/README.md`: no change.
- `packages/ui/README.md`: lists every part, stories are optional, the e2e path is `e2e/suites/ui/`, handler wording.
- Skill: `SKILL.md` already says never to write client script tags and names Nitro and `srvx/node`; no change. `references/state.md` names BRM217; `references/syntax.md` covers a held `#template` call; `references/events.md` says wrappers apply while the event dispatches. `references/signals.md` checked, no change. `references/errors.md` is generated.
- `website/ui/introduction.md`: dropped the "not published yet" note (`@brumate/ui` 0.3.1 is on npm). `state.md`: `render` belongs to `SelectValue`; added `ColorScheme value`. `your-own-parts.md`: `DialogContext` comes from Popover and ModalOverlay; added `ToggleButtonContext`, `SeparatorContext`, `FieldInputContext`. `resuming.md`: the toolbar keys before and after its code loads. `async-content.md`: the scope of BRM217. `keyboard-and-focus.md`, `layers.md`, `styling.md`, `influences.md`: checked, no change.

## 0.10.0 changesets and their pages

| Changeset                                                  | Documented on                                                                                                                                                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default-scripts`                                          | `deploying.md` "The script tags"; `reference-server.md` `virtual:brumate/routes`; `reference-plugin.md` `clientOutDir`; `client-modules.md` "When the page starts"; `routing.md` "Serving routes"; `getting-started.md` |
| `dev-pages`                                                | `reference-plugin.md` "The dev server"; `routing.md` "Serving routes"; `getting-started.md`                                                                                                                             |
| `kept-page-nonce`                                          | `routing.md` "Caching pages"; `reference-security.md` "Content security policy"; `deploying.md`                                                                                                                         |
| `nitro-prerender`                                          | `deploying.md` "Under Nitro", "Early hints", "Skew protection"; `reference-server.md` (shell); `reference-security.md` (shell nonce)                                                                                    |
| `script-nonce` (`RouteOptions`)                            | `reference-server.md` `RouteOptions` table; `reference-plugin.md` Modules; `routing.md`                                                                                                                                 |
| `skill-client-scripts`                                     | `packages/brumate/skills/brumate/SKILL.md`; `client-modules.md`                                                                                                                                                         |
| `state-printed-html`                                       | `reference-serialization.md` "Raw HTML that the page printed"; `page-format.md` "Raw HTML that the page printed"; `markup.md` "HTML strings"                                                                            |
| `defer-in-browser-render` (BRM217, `analyzeProjectDefers`) | `errors.md#brm217` (generated); `async-data.md` `#defer`; `reference-blocks.md`; `components.md` children; `reference-plugin.md` Compiler API; `website/ui/async-content.md`; skill `references/state.md`               |
| `defer-stylesheets`                                        | `async-data.md` `#defer`; `styles.md`; `page-format.md` `#loading` and `#defer`; `style-compilation.md`; `deploying.md`                                                                                                 |
| `template-call-insert-scopes`                              | `control-flow.md` `#template`; `components.md`; `reference-blocks.md`; `reactive-graph.md`; `page-format.md`; skill `references/syntax.md`                                                                              |
| `template-call-try`                                        | `control-flow.md` `#try`; `components.md`; `reactive-graph.md`; skill `references/syntax.md`                                                                                                                            |
| `memo-template-resume`                                     | `control-flow.md` `#template` (a kept call updates every place after resume)                                                                                                                                            |
| `stop-ends-loads`                                          | `reference-server.md` (what the stop function of `start` ends)                                                                                                                                                          |
| `svg-ambiguous-clone`                                      | `client-modules.md`                                                                                                                                                                                                     |
| brumate-node dropped                                       | `deploying.md`, `SKILL.md`, `packages/brumate/README.md`, `README.md`: Nitro or `toNodeHandler` of `srvx/node`                                                                                                          |

## Checker

`docs_check.py website/docs`: 41 pages, 1 error, 0 warnings (was 41 errors, 19 warnings).

- The error: `errors.md` has no `type:`. The page is generated by `renderErrorsPage` in `packages/brumate/src/error-catalog.ts`, and `test/check-command.test.ts` compares it with the file, so a hand edit fails the test. See Findings.
- `--exports packages/brumate/src/index.ts`: about 40 compiler exports (types such as `CompileOptions`, `Plan`, `SourceMap`, and functions such as `generateClient`, `createPlan`, `printAST`) have no reference entry. `reference-plugin.md` documents the tool-facing part of the compiler API (`compile`, `inspect`, `report`, `analyzeProject`, `analyzeProjectProps`, `analyzeProjectDefers`, `formatReport` and their options). The rest serves the language tools and tests. See Findings.
- `surface.py --base $(merge-base main HEAD)`: no stale names in docs in scope. The "changed" hits are internal names in `docs/debates`, `docs/architecture` and benchmarks, outside this node.
- `check_prose.py` on changed pages: no errors. Long-sentence warnings remain on lines older than this node.

## Findings for the orchestrator

1. `renderErrorsPage` (`packages/brumate/src/error-catalog.ts:1341`) should start the page with `---\ntype: reference\n---`, so `errors.md` passes the docs checker. A code change plus a regenerated page (`UPDATE_SKILL=1` in the check-command test).
2. Stale code comments: `packages/brumate/src/runtime/loader.ts:13-16` says the loader loads `brumate/client` on the first event, and `runtime/server.ts:4648-4652` says "the core that the first event loads". `boot.ts` calls `loadCore()` at start.
3. `packages/brumate/src/vite.ts:1727-1739`: a missing `.brumate/hints.json` is silent, so a server that only calls `render()` loads no client code and prints no warning.
4. The compiler exports of `src/index.ts` without a reference entry (see Checker). Either document them on a generated reference page, or mark the ones the language tools use as internal.
5. `docs/decisions.md:145` still describes the `next` branch policy, which closed after 0.7.0.
6. `packages/ui/skills/brumate-ui/SKILL.md` was outside this node's paths and was not audited.
7. Not confirmed: `DatePicker` resetting with its form (`website/ui/state.md` leaves it out; it wraps `DateField`, which resets; no test). `b-hole` on prerendered shells (`server.ts:4883`) is not in `page-format.md`. The VS Code extension is `private: true`, so `editor.md` gives no install path beyond the source.
8. `context.md` says browser-rendered components get their own copy of `<script module>`. This reads as a known core issue; confirm it still holds.

## Checks

- `pnpm --filter website check:samples`: 72 samples, 0 problems.
- `pnpm --filter website build`: passes.
- `pnpm --filter brumate exec vitest run test/skill.test.ts test/check-command.test.ts`: pass (the skill's code blocks compile, `errors.md` matches the catalog).
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: pass.
- `node e2e/run.mjs --only website`: 81 passed, 0 failed.
