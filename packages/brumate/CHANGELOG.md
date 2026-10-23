# brumate

## 0.2.0

### Minor Changes

- 62da1c8: `await` says where the server waits instead of streaming. `const name = await $memo(value)` declares a memo that the page waits for where it is declared, and `await name` of a memo waits for it in the render around the read: the page, the `#loading` body around the block, or the request for a `#defer` body. A run of `await $memo` declarations, one after another, loads at the same time. In the browser the value is settled, so both are plain reads.

  A `#loading` body whose values are ready when the block renders, and that renders no component, dynamic tag, template or prop, renders in place: no fallback, no swap, and its scopes are in the page state. A page that waits for every value it loads has one state record.

  A component whose script awaits a promise rendered a broken render module. It now renders on the server only, and the browser throws a clear error when it renders the component. An `await` of a promise in markup that the browser renders or updates is a compile error.

- 9609d77: `batched(readMany, lookup, options)` from `brumate/batch` turns the calls of one moment in the browser, such as the rows of a list that renders, into one call with every key. On the server, each call reads its own key at once.

  A component that the browser renders now calls the server functions of its memos once, instead of twice: the first compute of a memo takes the promise that the render made.

- 2e3cb9c: `#client { … } #else { … }` renders the `#else` body on the server, in place of the body, until the browser renders the body. Without scripts, the fallback stays.
- 1b8c722: An error in client code goes to the nearest `#try` around the scope of the code: a handler that throws, or whose promise rejects, an effect, a `$client` callback, or a memo whose load rejects. The `#catch` body renders in the browser, with the error and `reset`. A `#try` whose body holds client code ships both bodies. Without a `#try`, the page gets a `brumate:error` event on `window`, with the error and the scope, and the error is logged. `onError` of the loader receives every error first.
- e1d482b: A `$client` callback with the `'visible'` trigger that reads an element of its markup through `ref` now runs when that element comes into view, instead of the first element of the component. The code of a chart low on the page loads when the chart is in view.
- 390b5c3: `#defer (trigger) { … } #else { … }` renders its body on the server in a later request. The page has the `#else` body until the trigger fires. The browser then asks the server for the body, which replaces the fallback. The request goes to the URL of the page, so middleware and cookies apply as they do for the page.
- 3a10276: Pages hint the modules that every page loads, the loader and the core: `<link rel="modulepreload">` in the head, and `Link` headers that hosts can turn into `103 Early Hints`. `earlyHints` in the options of `route` receives the links before the page renders, for a server that sends `103` itself, such as with Node's `writeEarlyHints`. The client build writes the URLs to `.brumate/hints.json`.
- b72f505: `defineEnv` from `brumate/env` declares the environment variables of the app in `src/env.ts`, with a Standard Schema for each, split into server and public values. The server checks them when it starts, and fails with every missing or wrong one. The browser gets the file without the server schemas, with the values of the public variables written in. Only components import the file in code that the browser loads. The compiler reports a read of a server variable in code that runs in the browser, and a value made from one that the page state would send. The server refuses to send a page whose state holds the value of a server variable, and the error at start does not print one. The `env` option of the plugin names another file, or `false` uses none.
- 56e1e1d: `budget.event` fails the client build when the first run of one handler loads more than a size, and `budget.component` when one component ships more. The error names the component, the handler and its largest imports. `report: true` lists the largest handlers.
- 5c1f02c: For readers that run no scripts, the server renders `#loading` and `#defer` bodies in place, in the order of the page, with no `<template>` and no swap. The page arrives later, complete, with the same state. `inOrder` in the options of `handle`, `render` and `renderToStream` decides: `'bots'`, the default, for requests whose `User-Agent` is a known crawler, `true`, `false`, or a function of the request.

  `getEvent().signal` aborts when the request's signal does, or when the reader of the response goes away, for pages, server function calls and `#defer` requests. A page that the reader left sends no more `#loading` bodies.

- 5eabd62: The children of a component render where the component inserts them, so they read the contexts that the component provides. A part passed into a component, such as a `Label` inside a `Select`, now reads the context of the `Select`, on the server and in the browser.
- 37ddbf6: `src/middleware.ts` runs for every request of the app, before the `_middleware.ts` of the folders: pages, endpoints, server function calls, form posts and the requests for `#defer` bodies. Its default export, written with `defineMiddleware`, takes the `RequestEvent` and `next`. `event.kind` says what the request is for, and `event.call` has the server function of a call and its arguments. A `'use server'` file can export `middleware` for its own functions. The `middleware` option of the plugin names another file, or `false` runs none.

  Middleware hands values to the rest of the request through `event.locals`, typed by the `Locals` interface of `brumate/server`, which an app adds fields to. `event.waitUntil(promise)` keeps work going after the response ends, through the `waitUntil` option of `handle` on hosts that have one.

- d0bc8df: `navigate(href, { replace, scroll })` from `brumate/routes` loads a page as a link does, and returns when it shows. `$route()` gives the URL, the query string and the params of the route, typed from the route files, on the server and in the browser, and updates when navigation changes it. `$navigation()` gives the navigation that loads, `{ pending, from, to }`. The loader sets `data-navigating` on `<html>` while a page loads. After a navigation, it announces the new page to screen readers in a live region, and moves the focus to the first `<h1>` of the new content, or to `<main>`, except when only the query string changes. `navigate: { focus: false }` in the plugin keeps the focus.
- c794d01: `brumate/events` wraps event handlers with what must happen before their code loads: `prevent(handler, ...keys)`, `stop(handler)`, `once(handler)` and `capture(handler)`. The compiler reads the wrappers in markup, so the loader applies them on the first event. On a keyboard event, `prevent` can name the keys to prevent, such as `onKeyDown=(prevent(move, 'ArrowDown', 'Enter'))`, and TypeScript checks the names. A modifier after the event name, such as `onSubmit:prevent`, still works, with a warning that points to the wrapper. A modifier on a component is now a compile error, since nothing applied it.
- 49c7a0f: `rateLimit({ max, window, key? })` from `brumate/server` limits how often a client can call a server function. Called first thing in the function, it counts the calls of each key in a sliding window and rejects the ones over the limit with a `RateLimitError`: status 429, `Retry-After`, and `retryAfter` in the browser. The key is the app's, such as the email of a sign-in or the ID of a user, from the event and the arguments, or else the address of the client. Each call counts with one atomic increment before the limit decides, so calls at the same time cannot all pass. `rateLimit.middleware(options)` limits every request under a folder of routes, or of the app from the entry middleware, and counts each route by its pattern, which `event.route` gives. `rateLimit.strict` is a preset for sign-ins. The counts live in memory, or in a store with an atomic increment, such as Redis, through `configureRateLimit({ store })`. `clientAddress(event)` reads the address of the client from the server, which passes it to `handle` as `address`, or from `X-Forwarded-For` when that address is one of the proxies that `configureRateLimit({ proxies })` names. A malformed range throws. Without a key or an address, a limit throws in production and warns in development. Limits count unless turned off, and never while the build prerenders.
- 633273b: The page state and server function calls send the web values of `seroval-plugins`: `Headers`, `FormData`, `Request`, `Response`, `ReadableStream`, `AbortSignal`, `Event`, `CustomEvent` and `DOMException`, next to `URL` and `URLSearchParams`, whose plugins replace brumate's own. A `ReadableStream` streams its chunks as they are ready. An `AbortSignal` goes as it is when sent, with whether it aborted and its reason. `Blob` and `File` still go only in the arguments of a call, as parts of multipart form data, and now from anywhere in them, such as a `Map`, a `Set` or a `FormData`.

  The sync paths of the page state and of shared calls no longer take an async iterable as an empty stream: the page state streams it, and a call with one in its arguments is not shared with another.

- 8890c2f: Skew protection. Each build has an ID, which the client build writes to `.brumate/build.json` and the server build reads, or `BRUMATE_BUILD` in the environment names for both. The page state carries it, and the browser sends it with each server function call and each request for a `#defer` body. A call from a page of another build to a function that is gone answers 409, and the browser loads the next page in full and posts a form of `$action` again without scripts. Forms carry the ID as `__build` in their URL, and a post without scripts from another build to a function that is gone answers 303 to its page. When the code of a handler fails to load and the server is of another build, the page loads again. Client navigation loads a page of another build in full. A page loads again, or in full, once for each build in a tab. The page gets a `brumate:skew` event first. `skew: { keep }` in the plugin keeps the files of earlier builds in the client output.
- ced8c27: A handler that a component passes on with a spread, such as `onClick` in `{...rest}`, now reaches the element, with its wrappers of `brumate/events`, and runs in the component that passed it. An update of a spread in the browser removes the attributes that the new value drops.
- c0e834d: A `#template` passed as a prop renders in the browser, such as a list item whose selection changes. It used to fail the render. The template keeps reading the values of the component that wrote it.
- a17d60b: `visit(path)` from `virtual:brumate/testing` answers a path with the routes of the app and resumes the page in the DOM of a test. Links use client navigation, and forms, server function calls and `#defer` requests go to the same routes, with the cookies that the answers set. Responses of the server now keep their `set-cookie` headers in DOM environments such as happy-dom, which drop them from the headers that a response is made with.
- 418ccb8: `$debounced(value, ms)` and `$throttled(value, ms)` from `brumate/signals` are memos that the browser writes after a wait: once the value stops changing for `ms`, or at most once every `ms`. On the server, both are the value itself. The memo is pending while it waits, so `$isPending` is true.
- a15e5d4: A `<title>` in `#head` sets the title of the page. The last one in the page wins, so a title in an `#if` needs no code in a script, and the title changes as blocks add and remove them. A `<title>` elsewhere in the markup is an error, except in an `<svg>` or a `<head>` element. `$title` still works, with a warning that points to `<title>`, and goes in a later version.
- 7c05f82: **Upgrading from 0.1.** These changes need attention:

  - The page format changed. The scopes inside blocks and `#loading` bodies have IDs such as `4.0`, so the client of one version cannot resume a page that another version rendered. Deploy the server and the client build together. Skew protection loads such a page again in full.
  - Event handlers run as if each element had its own listener. `:capture` handlers run first, and an event that does not bubble, such as `focus`, no longer runs the handlers of the elements around its target.
  - A modifier after an event name, such as `onSubmit:prevent`, still works, with a warning. Use the wrappers of `brumate/events` instead. A modifier on a component is now a compile error.
  - `URL` and `URLSearchParams` use the plugins of `seroval-plugins` in place of brumate's own, so state that a page of 0.1 wrote does not resume with 0.2.

### Patch Changes

- 0b95cbc: The scopes inside `#if`, `#switch`, `#for`, `#repeat`, `#try` and `#offscreen` get IDs after an ID of their block, such as `4.0`, so the markup after a block keeps its IDs whatever the block rendered. A `#defer` body then loads on a page whose markup before it depends on the user, such as a prerendered page. The page format changed, so the server and the client must come from the same version.
- ef3e305: The scopes of a `#loading` body get IDs after the ID of their boundary, such as `5.0`, so the IDs of a page no longer depend on the order in which its `#loading` data arrives. `$id()` inside a `#loading` body gives an ID such as `b5_0-0`, which also works as a CSS selector. The page format changed, so the server and the client must come from the same version.
- e3c6aee: Fixes how the loader runs handlers. `:capture` handlers now run before the handlers of the elements inside. An event that does not bubble, such as `focus` or `mouseenter`, no longer runs the handlers of the elements around its target. `:prevent` on `wheel` and `touchmove` now prevents: the listener of a type is passive only while no handler of the type prevents, so `:passive` is no longer needed.
- 5baf5b7: Pages render faster on the server. A page with lists or `#if` blocks no longer pays for a lookup table of every scope ID.
- d338381: On the dev server, a change to a module that only the server reads, such as data or Markdown that a page renders, now reloads the page. Before, the page kept showing the old content until a manual reload.
- ab4d9cc: A page with no pending `#loading` body sends a smaller state script, and renders faster on the server. The script assigns only the values that it uses more than once.
- 95ce0cd: An element with a spread writes each attribute once. A later attribute wins, and a `class` of the spread adds to the `class` of the element. The element used to get two `class` attributes, and the browser kept the first.
- adad4ea: The core works on a site whose Content Security Policy has `require-trusted-types-for 'script'`. It makes a Trusted Types policy named `brumate`, once, when it first inserts markup, and passes the markup that it renders and the scripts of `#defer` bodies and of pages that the client router loads through it. Allow it with `trusted-types brumate`.

## 0.1.1

### Patch Changes

- 96c35be: The server renders memos, signals and inserts that always give a primitive, such as `$memo(count * 2)`, `let count = $signal(0)` with `count++`, or `{index + 1}`, without a memo object or a check for a promise. Inserted literals, such as `{'<b>'}`, are escaped when the component compiles.

## 0.1.0

### Minor Changes

- 246a5e1: - An app can use `.brm` components, `.brm.ts` modules and `'use server'` files from an npm package. The package opts in with a `brumate` field in its `package.json`, and the plugin of the app compiles its files.
  - The IDs of the components and server functions of a package come from the package name and the path in it, so they stay the same however the package is installed.
  - A server function of a package becomes an endpoint only when the app imports its file, directly or through the package.
  - The plugin keeps these packages out of Vite's dep optimizer and compiles them into the server build.
- afe220a: `$provide` is now `$setContext`, and `$context` is now `$getContext`. They take the same arguments as before.

  An import or a call of `$provide` or `$context` is a compile error that names the new function, such as `$provide was renamed to $setContext`.

- c530c07: First release of brumate: the compiler, the Vite plugin, the server and client runtimes, routing, type-checking for `.brm` files, and a language server with a VS Code extension.
- 4825dbb: - `#offscreen (visible) { … }` hides its body when `visible` is false and keeps it in the page, with its elements, form fields and state. A body that is hidden when the page renders is rendered in the browser the first time it shows.
  - While the body is hidden, its effects, `$client` callbacks and `<window>` and `<document>` listeners do not run, and its portals are hidden too.
  - `#defer` is reserved for a future block. Using it is a compile error.
- 0a2b5a3: Pages are smaller and render faster, and the first click needs less code. This changes the page format, so the server and the client must come from the same version.

  - The page state is written as inline scripts. Pages with a Content Security Policy must pass `nonce` to `render`. Code that read `type="brumate/state"` scripts as JSON must change.
  - The attributes that brumate writes start with `b-` instead of `data-`, such as `b-b` and `b-on`. An element attribute that starts with `b-` is now a compile error. `data-prefetch` and `data-reload` are unchanged.
  - `brumate/client` no longer exports `context`. `portal` is now `portalTo`, and `provide` is now `updateContext`.
  - The core no longer listens to the `brumate:hot`, `brumate:remount` and `brumate:refresh` events.
  - After `load`, pages preload the code of components with handlers near the viewport. Set `preload: false` to turn it off.
  - `brumate/static-loader` is the loader without client navigation. The plugin uses it with `navigate: false`.
  - `brumate/server` exports `parse`, `safeParse`, `parseForm` and `fieldErrors`, which check server function arguments with any Standard Schema library.
  - A `'use server'` function declared in `<script module>` can now be called from the browser.
  - A path with a malformed escape, such as `/%E0`, answers 404 instead of 500.

### Patch Changes

- 246a5e1: - `answerCalls()` from `virtual:brumate/testing` answers the server function calls of a component test with the real server functions, in the test process. It returns a function that restores `fetch`.
  - In a DOM test, the server version of a component (`?brumate-server`) and `virtual:brumate/server` now import the server code of `'use server'` files, not the browser stubs.
- 3e39ba2: - A link that keeps the layout no longer loads the memos of the new page again after a value changed on the page before. Before, such memos called their server functions again.
  - A redirect from a server function call or from the form of an `$action` now loads the page on the client, as a form without `$action` does, with a view transition of the type `form`. A redirect to another site, or with `navigate: false`, still loads the page in full.
  - `unmount()` of `mount` from `brumate/testing` removes the scopes of the component from the client runtime. A refresh in a later test no longer loads the memos of components that unmounted.
  - A `<window>` or `<document>` listener of markup that is gone, such as a page that client navigation replaced, no longer runs.
- f186260: - A value in a `<textarea>` or a `<title>` renders without comment markers, which became part of the text. A value that changes must be the whole content of the element, and the compiler reports one that is not. The client sets the text, and the `value` of a `<textarea>`.
  - A `#try` body that throws on the server no longer leaves anything in the page: its stylesheets are sent with the next copy of the component, and its `#portal` and `#head` markup, its title and its `#loading` bodies are left out.
  - `brumate-tsc` no longer reports TS2440 when a file imports the name that its file name gives the component, such as `SignIn` in `sign-in.brm`.
  - Prerendering writes the SHA-256 hashes of the inline scripts of each page to `.brumate/prerender.json` in the client build, for a Content Security Policy without a nonce.
- 2bb5c7f: - A `#try` body that throws while the server renders no longer leaves its scopes in the page state. The browser could update them, and fail, such as after a client navigation.
  - In development, `event.refresh(fn)` in a component's server function now refreshes a function of a `'use server'` file, as it does in production.
