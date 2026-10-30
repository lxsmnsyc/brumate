# The brumate package

All paths in this page are under [`packages/brumate`](../../packages/brumate). Back to the [overview](../architecture.md).

The package has three parts that share types and a few modules:

- The compiler, in `src` and `src/codegen`. It runs in Node, in the Vite plugin, in the CLI and in the editor.
- The server runtime, in `src/runtime`. It renders pages and answers calls.
- The client runtime, in `src/runtime/boot.ts`, `src/runtime/client.ts` and `src/runtime/client/*`. It ships to the browser, so its size is a requirement.

Entry points are the keys of `exports` in [`package.json`](../../packages/brumate/package.json) and the `entry` list in [`tsdown.config.ts`](../../packages/brumate/tsdown.config.ts). A new public module needs an entry in both, and an alias in [`vitest.config.ts`](../../packages/brumate/vitest.config.ts) if a test imports it by its package name.

## Compiler pipeline

[`compile.ts`](../../packages/brumate/src/compile.ts) calls the stages in this order. [compiler.md](../compiler.md) and [ir.md](../ir.md) describe the data between them.

| Stage                  | File                                                                                                      | Does                                                                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modules                | `modules.ts`, `packages.ts`, `shared-module.ts`                                                           | Expands calls of `.brm.ts` reactive modules into the file. Reads components that come from packages. Shares module code between parts.                                                                                                                               |
| Parse                  | `parser.ts`, `ast.ts`, `scan.ts`, `oxc.ts`, `nesting.ts`                                                  | Reads markup, blocks and attributes. Hands scripts and expressions to oxc. `nesting.ts` applies the HTML rules for implied closing tags.                                                                                                                             |
| Compile-time functions | `macros.ts`                                                                                               | Finds `$signal` and the others by their import from `brumate/signals`.                                                                                                                                                                                               |
| Analyze                | `analyze.ts`, `model.ts`                                                                                  | Builds scopes and declarations, and resolves every read and write.                                                                                                                                                                                                   |
| Checks on the model    | `pending-reads.ts`, `a11y.ts`                                                                             | Reports reads of values that can be missing, and accessibility mistakes in markup.                                                                                                                                                                                   |
| Graph                  | `graph.ts`                                                                                                | Builds nodes and edges, the client roots, what each root reaches, and which nodes are live. Props are live only when a parent can change them (`project.ts` finds that across files).                                                                                |
| Plan                   | `plan.ts`                                                                                                 | Decides scope IDs, anchors, and the split into entry, parts and shared code.                                                                                                                                                                                         |
| Checks on the plan     | `captures.ts`, `env-check.ts`                                                                             | Reports values the page state cannot send, and server environment variables read in browser code.                                                                                                                                                                    |
| Codegen                | `codegen/server.ts`, `codegen/client.ts`, `codegen/render.ts`                                             | Writes the three outputs. `render.ts` writes the render module for markup that the browser renders.                                                                                                                                                                  |
| Codegen helpers        | `codegen/markup.ts`, `codegen/template.ts`, `codegen/scopes.ts`, `codegen/rewrite.ts`, `codegen/patch.ts` | `markup.ts` writes markup for the server and the client. `template.ts` writes cloned `<template>` markup. `scopes.ts` writes the code that finds a scope instance. `rewrite.ts` rewrites client code to read and write slots. `patch.ts` edits ranges of the source. |
| Output                 | `sourcemap.ts`, `css.ts`, `generate.ts`                                                                   | Turns marks in the generated code into source maps. Scopes styles. `generate.ts` exports the generators alone.                                                                                                                                                       |

Support files of the compiler:

| File                                                | Does                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `error.ts`, `error-catalog.ts`                      | The error type, code frames, and the catalog of codes (BRMnnn) with message, cause and fix.        |
| `check.ts`                                          | `toTypeScript`: the `.brm` file as TypeScript for the editor and `brumate-tsc`.                    |
| `check-command.ts`, `cli.ts`                        | The CLI: `brumate inspect`, `brumate check` and `brumate skill`.                                   |
| `inspect.ts`, `print.ts`                            | The report of what a component ships and why, and printers for the tree, model and graph.          |
| `highlight.ts`, `highlight-keywords.ts`             | The highlighter for the devtools and the website. A test keeps the keywords equal to the parser's. |
| `features.ts`                                       | Which features of the core a compiled component uses, for pruning the client build.                |
| `event-names.ts`, `refreshes.ts`, `server-files.ts` | Event name rules, which memos a server function refreshes, and `'use server'` files.               |
| `files.ts`, `node.ts`, `version.ts`                 | Finding `.brm` files, lazy Node built-ins (so the compiler runs in a browser), the version.        |

## Vite plugin

[`vite.ts`](../../packages/brumate/src/vite.ts) is the default export of `brumate/vite`. It is large, so read it by hook.

- `buildStart` scans the root for `.brm` files and reads the project (props across files, refreshing server functions, packages).
- `resolveId` and `load` serve the virtual modules: `virtual:brumate/start`, `manifest`, `bundle/<id>`, `server`, `routes` and `testing`. A `.brm` file has three outputs under the queries `?brumate-client`, `?brumate-render` and `?brumate-server`.
- `transform` compiles `.brm` files, `.brm.ts` modules and `'use server'` files.
- `configureServer` and the hot update hook run the dev server: the error overlay (`dev-error.ts`), hot updates (`runtime/hot.ts`), the devtools panel endpoints and the workbench (`workbench.ts`, `workbench-page.ts`).
- `generateBundle` writes the build report (`report.ts`) and the build ID for skew protection (`builds.ts`). `prerender.ts` writes static pages after the server build.
- Routes: `routes.ts` builds the route tree of `virtual:brumate/routes` from `src/routes`.

Options are documented for users in [Plugin options](../../website/docs/reference-plugin.md).

## Server runtime

[`runtime/server.ts`](../../packages/brumate/src/runtime/server.ts) is about 4,300 lines. Compiled server modules import it as `brumate/server`.

| Area                      | Where                                                                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render context and scopes | `Context`, `component`, `children`, `dynamic` and `insert` in `server.ts`.                                                                                                                                                                                          |
| Memos and waiting         | `memo`, `read`, `wait` in `server.ts`. A memo that loads throws `NotReady`, which carries the load.                                                                                                                                                                 |
| `#loading` and `#defer`   | `renderToStream` and `streamParts` in `server.ts` send the fallback first and the body later in a `<template>`, with an inline swap script. `inlineBodies` renders bodies in place for readers without scripts. `runtime/defer.ts` is the browser side of `#defer`. |
| State records             | `packState`, `streamState` and `stateScript` in `server.ts`. `runtime/serial.ts` has the seroval plugins. `runtime/shared.ts` has the types and values that the server and the core share. `runtime/values.ts` is `brumate/serial` for app plugins.                 |
| Documents and head        | `render` and `renderToStream` add the doctype, the head, the state and the scripts.                                                                                                                                                                                 |
| Requests                  | `handleRequest` in `server.ts` and `runtime/request.ts` tell a call, a form post, an endpoint and a page apart. `isCrossSite` refuses posts from other sites.                                                                                                       |
| Routes                    | `handleRoute` in `server.ts`, `runtime/router.ts` (matching, endpoints) and `runtime/routes.ts` (`Routes` links).                                                                                                                                                   |
| Server functions          | `src/server-files.ts` compiles `'use server'` files. `runtime/rpc.ts` is the browser caller. `runtime/stream.ts` streams the answer. `runtime/calls.ts` has call-only values. `runtime/batch.ts` joins the calls of one moment.                                     |
| Forms                     | `runtime/forms.ts` (shared with the browser), `runtime/submission.ts` (the server side), `runtime/validate.ts` (Standard Schema), and `forms/forms.brm.ts`, which is `brumate/forms`. `runtime/idempotent.ts` protects forms that must not post twice.              |
| Cache, cookies, limits    | `runtime/cache.ts`, `runtime/cookies.ts`, `runtime/rate-limit.ts`.                                                                                                                                                                                                  |
| Environment and secrets   | `runtime/env.ts`, `runtime/secrets.ts`. The server refuses a page whose state holds a server variable.                                                                                                                                                              |
| Skew and builds           | `runtime/skew.ts` in the browser, `src/builds.ts` in the build.                                                                                                                                                                                                     |
| Streams of values         | `runtime/gather.ts` is `brumate/stream`.                                                                                                                                                                                                                            |

## Client runtime

The core keeps only what every page needs, and each helper is its own export, so a build drops the ones that no component calls. Features that change how the core reads the page are separate modules that set hooks when they load. See [compiler.md, Runtime](../compiler.md#runtime) for the sizes and the reason.

| File                                                                                                                            | Does                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `runtime/loader.ts`, `runtime/static-loader.ts`                                                                                 | `start()` with client navigation, and `startWithoutNavigation` for `navigate: false`.                                           |
| `runtime/boot.ts`                                                                                                               | What every loader does: listen for `b-on`, apply event wrappers, start bundles, hold early events.                              |
| `runtime/events.ts`                                                                                                             | The wrappers of handlers (`prevent`, `stop`, `once`, `capture`, `cancelWhen` and the others).                                   |
| `runtime/navigate.ts`, `runtime/client-routes.ts`                                                                               | Client navigation, and the reader for the records that navigation adds.                                                         |
| `runtime/client.ts`                                                                                                             | The public exports of the core. Its header lists the order in which `client/*` modules may import each other.                   |
| `runtime/client/state.ts`                                                                                                       | Types and shared state of the core. It imports nothing from the core.                                                           |
| `client/code.ts`, `client/references.ts`                                                                                        | Loading the modules and parts of components, and calling a function by reference such as `Page#h3`.                             |
| `client/blocks.ts`, `client/scopes.ts`                                                                                          | Indexing comment markers and anchors, and the tree of scopes. Scopes made by the client get negative IDs.                       |
| `client/resume.ts`                                                                                                              | Reads the state records and starts the core. Also what leaving a page drops.                                                    |
| `client/updates.ts`                                                                                                             | Slots, memos, effects and the update pass that a write runs. Ordered updates live here.                                         |
| `client/handlers.ts`                                                                                                            | Event handlers, merged handlers from spreads, and server calls from forms.                                                      |
| `client/branches.ts`, `client/lists.ts`                                                                                         | `#if`, `#switch`, `#key`, `#try`, `#client`, `#offscreen`, and `#for` and `#repeat` with keys.                                  |
| `client/templates.ts`, `client/insert.ts`, `client/inserts.ts`, `client/children.ts`, `client/components.ts`, `client/props.ts` | Markup that the browser renders: cloning templates, inserting HTML, writing values, children, child components and their props. |
| `client/context.ts`, `client/errors.ts`, `client/guesses.ts`, `client/page.ts`, `client/titles.ts`                              | Contexts, errors to `#try`, `$optimistic` guesses, `#head`, `#portal` and styles, and the title.                                |
| `runtime/features.ts`                                                                                                           | Build-time flags (`HAS_BINDINGS` and others) that let a bundler drop unused code.                                               |
| `runtime/hot.ts`                                                                                                                | Hot updates in the dev server.                                                                                                  |

Rules of this code:

- It is size-sensitive. Core changes report the gzip size of `examples/todos` with `pnpm bench`, within 0.3 kB. [performance.md](../performance.md) has the baseline.
- `boot.ts` keeps arrow functions and `Array` methods on purpose, since loops and declarations measured larger after gzip. Do not apply the usual style rules there.
- A module outside the core imports it with `import()`, not a static import, so the bundler does not move the core behind a re-export chunk.

## Devtools, testing and the workbench

| Part      | Files                                                                | Notes                                                                                                                                              |
| --------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Devtools  | `runtime/devtools.ts`, `runtime/devtools-panel.ts`, `src/inspect.ts` | The overlay listens to the core through hooks, and the panel loads when its button is pressed. Hooks run only where `import.meta.env.DEV` is true. |
| Testing   | `runtime/testing.ts` (`brumate/testing`)                             | `mount` renders on the server and resumes in a DOM. `visit` does the same for a route. Tests of apps and of `@brumate/ui` use it.                  |
| Workbench | `src/workbench.ts`, `src/workbench-page.ts`                          | A dev page at `/__brumate/workbench` that shows components which depend only on props. `*.stories.ts` files give named props.                      |
| Reports   | `src/report.ts`, `src/inspect.ts`                                    | The build report with size budgets, and `brumate inspect`.                                                                                         |

## Type files

These files at the package root ship as they are.

- `types.d.ts` declares the `.brm` module types, such as `*.brm?brumate-server`.
- `elements.d.ts` types the HTML elements, their attributes and their events. `tsconfig.elements.json` type-checks it.
- `check.d.ts` holds internal types of the TypeScript that `check.ts` generates. They are not public and can change in any release.
- `src/event-names.ts` and `ElementEventNames` in `elements.d.ts` must list the same names. A test checks it.
