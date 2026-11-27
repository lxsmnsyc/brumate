---
type: reference
---

# Runtime API

The modules that app code imports, other than `brumate/signals`. Most apps use only the request helpers of `brumate/server`, `href` and `createContext`. The rendering functions are for a custom server.

| Module                  | For                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `brumate/server`        | Server functions and rendering: the request, errors, redirects, streams.                                   |
| `brumate/routes`        | Links to routes, and navigation by code.                                                                   |
| `brumate/context`       | Contexts.                                                                                                  |
| `brumate/html`          | Raw HTML.                                                                                                  |
| `brumate/env`           | Checking environment variables.                                                                            |
| `brumate/loader`        | Starting the loader by hand.                                                                               |
| `brumate/static-loader` | Starting the loader by hand, without client navigation.                                                    |
| `brumate/testing`       | Component and route tests.                                                                                 |
| `brumate/otel`          | OpenTelemetry spans. See [Observability](./observability.md#opentelemetry).                                |
| `brumate/events`        | Wrappers of event handlers, and `cancelWhen`. See [Events](./reference-blocks.md#events).                  |
| `brumate/batch`         | `batched`, which turns many server function calls into one. See [Server functions](./server-functions.md). |
| `brumate/stream`        | `gather`, which turns a stream into a list. See [Async data](./async-data.md).                             |
| `brumate/store`         | Stores. See [Signals](./reference-signals.md#store).                                                       |
| `brumate/serial`        | Serialization plugins. See [Serialization](./reference-serialization.md).                                  |
| `brumate/forms`         | `createForm`. See [Forms](./forms.md#forms-with-createform).                                               |
| `brumate/devtools`      | The devtools grip. The dev server installs it.                                                             |
| `brumate/hot`           | Loading new component code on the dev server. The plugin wraps `load` with it.                             |
| `brumate/highlight`     | Highlights `.brm`, CSS and TypeScript code as HTML: `language`, `highlightFile`, `themeCSS`.               |
| `brumate/vite`          | The Vite plugin. See [Plugin options](./reference-plugin.md).                                              |
| `brumate`               | The compiler. See [Plugin options](./reference-plugin.md#compiler-api).                                    |

`brumate/client` is the core that the loader loads. Compiled code calls it, and apps do not. Its types `ClientModule`, `TraceHandler`, `TraceName` and `TraceSpan` are for app code. `brumate/bundles` and `brumate/forms/core` are internal too: the build and `createForm` import them.

## `brumate/server`: in server functions

`getEvent()` returns the `RequestEvent` of the request being handled. Call it in a server function, middleware or an endpoint before their first `await`, or anywhere in a component's script while a page renders with a request. Elsewhere it throws, including in a `.ts` helper that a component calls during render, because the compiler rewrites `getEvent()` only in `.brm` code. Call it in the component script and pass the event to the helper. See [The request](./server-functions.md#the-request).

| `RequestEvent` member                   | What it does                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `request`                               | The web `Request`.                                                                                                |
| `address`                               | The address of the client as the server saw it, when the server passed it.                                        |
| `kind`                                  | What the request is for: `'page'`, `'endpoint'`, `'call'` or `'defer'`.                                           |
| `call`                                  | For a call, and a page that a form posted to: the ID of the server function and its arguments.                    |
| `route`                                 | The pattern of the route that matched, such as `/todos/[id]`. Undefined for a path that no route matches.         |
| `prerender`                             | True while the build prerenders the page.                                                                         |
| `nonce`                                 | The nonce of the render, or undefined. A component that writes an inline script with `raw()` gives it this nonce. |
| `locals`                                | Values for this request, which middleware writes. Add fields to the `Locals` interface.                           |
| `waitUntil(promise)`                    | Keeps work going after the response ends. Passes the promise to the host through the `waitUntil` option.          |
| `signal`                                | Aborts when the request no longer needs an answer: its own signal aborts, or the reader of the response left.     |
| `headers`                               | Headers to add to the response.                                                                                   |
| `setStatus(status)`                     | The status of the page response, such as 404. Works during the first render of a page only.                       |
| `refresh(fn)`                           | Asks the browser to load again the memos that call the server function `fn`.                                      |
| `getCookie(name)`, `getCookies()`       | Cookies of the request, with the ones that this request set.                                                      |
| `setCookie(name, value, options?)`      | Sets a cookie: `HttpOnly`, `SameSite=Lax` and path `/` unless the options say otherwise, and `Secure` on HTTPS.   |
| `deleteCookie(name, { path, domain }?)` | Deletes a cookie.                                                                                                 |

| Export                                               | What it does                                                                                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getEvent(): RequestEvent`                           | The event of the request being handled.                                                                                                                                |
| `redirect(location, status = 303): never`            | Stops and sends the browser to `location`.                                                                                                                             |
| `isRedirect(error): boolean`                         | True for the error that `redirect` throws.                                                                                                                             |
| `new ServerError(message, { status = 400 })`         | An error whose message and status reach the browser. Other errors reach it as a generic message with status 500.                                                       |
| `createSession<T>({ secret, name, maxAge, cookie })` | A session in a signed cookie, with `get(event)`, `set(event, data)`, `update(event, change)` and `clear(event)`. `secret` is 32 characters or more, or a list of them. |
| `withEvent(event, callback)`                         | Runs a callback with an event, so `getEvent()` before its first `await` returns it. For custom servers and tests.                                                      |
| `rateLimit({ max, window, key? })`                   | Counts the calls of a key and rejects with a `RateLimitError` over the limit. See [Rate limiting](./security.md#rate-limiting).                                        |
| `rateLimit.middleware(options)`                      | The same as a middleware of a folder or of the entry: answers 429 over the limit.                                                                                      |
| `rateLimit.strict`                                   | 3 calls in 10 seconds, for functions that guess at secrets.                                                                                                            |
| `configureRateLimit({ store, proxies, enabled })`    | The defaults of every limit: the store of the counts, the trusted proxies, and whether limits count, which they do by default.                                         |
| `clientAddress(event)`                               | The address of the client, from the server, or from `X-Forwarded-For` when the server saw a trusted proxy.                                                             |
| `RateLimitError`                                     | The `ServerError` of a request over its limit: status 429 and `retryAfter` in seconds.                                                                                 |
| `defineMiddleware(middleware)`                       | Types the entry middleware, `(event, next) => Response`. See [Middleware](./routing.md#middleware).                                                                    |
| `Locals`                                             | The type of `event.locals`. An app adds fields to it with declaration merging.                                                                                         |
| `cached(fn, { maxAge, tags?, name? })`               | Keeps the results of `fn` by its arguments for `maxAge` seconds. See [Results that requests share](./server-functions.md#results-that-requests-share).                 |
| `idempotent(fn, { maxAge? })`                        | Runs a server function once for each form that the server renders for it. See [Forms posted twice](./forms.md#forms-posted-twice).                                     |
| `revalidate(...tags)`                                | Drops the results of `cached` functions with these tags.                                                                                                               |
| `setCacheStore(store)`                               | Sets where `cached` keeps results: an object with `get(key)` and `set(key, value, maxAge)`.                                                                            |
| `memoryStore(size = 1000)`, `storageStore(storage)`  | The default store in memory, and a store from an unstorage storage, such as Nitro's `useStorage()`.                                                                    |
| `PageCache`                                          | The type of the `cache` export of a route: `maxAge` and `staleWhileRevalidate`, in seconds. See [Caching pages](./routing.md#caching-pages).                           |
| `ServerErrorHandler`, `ServerErrorInfo`              | The types of the `onError` export of `src/middleware.ts`. See [Errors of the server](./routing.md#errors-of-the-server).                                               |
| `TraceHandler`, `TraceSpan`, `TraceName`             | The types of the `onTrace` export of `src/middleware.ts`. See [Observability](./observability.md).                                                                     |

See [Server functions](./server-functions.md) and [Cookies and sessions](./server-functions.md#cookies-and-sessions).

### Validation

These check values with any [Standard Schema](https://standardschema.dev), such as a schema of Zod, Valibot or ArkType. See [Validating arguments](./server-functions.md#validating-arguments) and [Validating a form](./forms.md#validating-a-form).

| Export                                               | What it does                                                                                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `parse(schema, value): Promise<T>`                   | The output of the schema. A value that does not match throws a `ValidationError` with status 400.                                   |
| `safeParse(schema, value)`                           | `{ value }` or `{ issues }`, without throwing.                                                                                      |
| `parseForm(schema, form)`                            | Turns the fields of a `FormData` into an object, and returns `{ value }` or `{ issues }`, without throwing.                         |
| `fieldErrors(issues)`                                | The messages by field: `Record<string, string[]>`, keyed by the path joined with dots. Issues without a path are under `''`.        |
| `parseSubmission(schema, form, options?)`            | Reads a form of `createForm`, applies the button that changes a list, and validates. See [Forms](./forms.md#forms-with-createform). |
| `Submission`, `SubmissionResult`, `ReplyOptions`     | The types of a submission, of its reply, and of the options of `reply`.                                                             |
| `ValidationError`                                    | The `ServerError` that `parse` throws. Its `issues` stay on the server.                                                             |
| `StandardSchemaV1`, `ValidationIssue`, `ParseResult` | The types of a schema, of an issue as plain data, and of the result of `safeParse` and `parseForm`.                                 |

These work anywhere:

| Export                                   | What it does                                                  |
| ---------------------------------------- | ------------------------------------------------------------- |
| `parseCookies(header)`                   | The cookies of a `cookie` header.                             |
| `serializeCookie(name, value, options?)` | A `set-cookie` header value.                                  |
| `toNodeHeaders(headers)`                 | Headers for Node's `writeHead`, with each `set-cookie` apart. |

## `brumate/server`: rendering

| Export                                                              | What it does                                                                                                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `renderToStream(Root, props, options?)`                             | Renders a component as a `ReadableStream<string>`. The first chunk is the whole first render. `#loading` bodies follow as they are ready. |
| `render(Root, props, options?)`                                     | Renders the parts of a page, for a server that sends headers before the stream. Returns a `RenderResult`.                                 |
| `streamParts(result, options?)`                                     | Streams the parts that `render` returned, as `renderToStream` does.                                                                       |
| `handleRoute(tree, request, options?)`                              | Answers a request with the matching route. `virtual:brumate/routes` calls it.                                                             |
| `matchRoute(tree, pathname)`                                        | Finds the route for a path.                                                                                                               |
| `handleRequest(functions, request, prefix = '/_brumate', options?)` | Answers a server function call, or returns `undefined` when the request is not one. `virtual:brumate/server` calls it.                    |
| `isCrossSite(request, options?): boolean`                           | True when a request comes from a page of another site. See [Security](./reference-security.md).                                           |
| `raw(html)`                                                         | The same as in `brumate/html`.                                                                                                            |
| `createContext(key)`                                                | The same as in `brumate/context`.                                                                                                         |
| `setClientBundles(bundles)`                                         | Sets the bundles that a render names when its options pass none. The Vite plugin calls it in a server build. See `RenderOptions`.         |

### `RenderOptions`

The options of `render`, and of every function that renders.

| Option      | Type                                        | Meaning                                                                                                               |
| ----------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `request`   | `Request`                                   | The request of the page, so `getEvent()` works while it renders.                                                      |
| `rpc`       | `string`                                    | The URL prefix of server function calls, for forms. Defaults to `/_brumate`.                                          |
| `nonce`     | `string`                                    | A Content Security Policy nonce for the inline scripts: the state records and the swap scripts of `#loading` bodies.  |
| `inOrder`   | `boolean \| 'bots' \| (request) => boolean` | Renders `#loading` and `#defer` bodies in place, for readers without scripts. `'bots'` by default.                    |
| `base`      | `number`                                    | The first ID of the render, for a second root on the same page.                                                       |
| `actions`   | `Map<unknown, unknown>`                     | Results of server functions that a form posted to this page, by function, for `$action`.                              |
| `route`     | `string`                                    | Names the route of the page. `handleRoute` sets it.                                                                   |
| `waitUntil` | `(promise) => void`                         | Keeps work going after the response ends, for `event.waitUntil`, such as `ctx.waitUntil` of Cloudflare Workers.       |
| `build`     | `string`                                    | The ID of the build, for skew protection. The page state carries it. The Vite plugin sets it in builds.               |
| `event`     | `RequestEvent`                              | The event of the request, in place of `request`, such as one that middleware already set cookies on.                  |
| `params`    | `Record<string, string>`                    | The params of the route of the page, for `$route`. `handleRoute` sets them.                                           |
| `address`   | `string`                                    | The address of the client as the server saw it, for `clientAddress` and rate limits.                                  |
| `prerender` | `boolean`                                   | True while the build prerenders the page. Rate limits do not count then.                                              |
| `onError`   | `ServerErrorHandler`                        | Gets the errors of a render without a request event. See [Errors of the server](./routing.md#errors-of-the-server).   |
| `onTrace`   | `TraceHandler`                              | Gets the spans of a render. See [Observability](./observability.md).                                                  |
| `defer`     | `{ boundary, at }`                          | Renders only the body of one `#defer` block, for the request that its trigger sends. Pass the `base` of the page too. |
| `linked`    | `Iterable<string>`                          | The URLs of the stylesheets that the page links already, so a component does not link them again.                     |
| `dev`       | `boolean`                                   | In development, the swaps of `#loading` bodies keep their fallbacks, for the devtools.                                |
| `printed`   | `boolean`                                   | False keeps printed raw HTML in the page state too. For tests.                                                        |
| `bundles`   | `ClientBundles`                             | The bundles of the client build that the page state names, so the browser loads the code of the page. See below.      |

In a build, a render names the bundles of the client build by default: the Vite plugin reads them from `.brumate/hints.json` of the client build and calls `setClientBundles(bundles)` when the server starts. A server that calls `render()` or `renderToStream()` itself needs no `bundles` option. Build the client first. A server build that uses the routes fails when it finds no client manifest. A server that only calls `render()` gets no bundles, so its pages load no client code. A `bundles` option wins over the default. The dev server loads each component by its module and names no bundles.

### `DocumentOptions`

The options of `renderToStream`, `streamParts` and `handleRoute` add these to `RenderOptions`:

| Option    | Type                                   | Meaning                                                                             |
| --------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| `scripts` | `string`                               | Markup after the page state, such as the client entry. Make module scripts `async`. |
| `head`    | `string`                               | Markup for the head, before the head of the components, such as a `<link>`.         |
| `start`   | `string \| ((head: string) => string)` | Markup before the component, for a component that does not render `<html>`.         |
| `end`     | `string`                               | Markup after the first render, for a component that does not render `<html>`.       |

`scripts` has no default in `renderToStream`, `streamParts` and `handleRoute`. The `handle` of `virtual:brumate/routes` writes the script tags of the client when `scripts` is unset, with the `nonce` of the render on each. A `scripts` that you pass, including `''`, is written as given. See [`virtual:brumate/routes`](#virtualbrumateroutes) and [The script tags](./deploying.md#the-script-tags).

`handleRoute` takes `RouteOptions`, which adds these to `DocumentOptions` and `RequestOptions`:

| Option        | Type                        | Meaning                                                                                                                                                 |
| ------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions`   | `Record<string, Function>`  | The server functions by ID, for forms that post to a page.                                                                                              |
| `hints`       | `string[]`                  | The URLs of the modules that every page loads. A page gets them as `Link` headers and `modulepreload` links.                                            |
| `bundleHints` | `Record<string, string[]>`  | The URLs of the bundle of each root component, by component ID. A page adds those of its views to `hints`.                                              |
| `earlyHints`  | `(links: string[]) => void` | Receives the `Link` values before the page renders. See [Early hints](./deploying.md#early-hints).                                                      |
| `shell`       | `string`                    | The HTML that the build prerendered for the path. The server sends it at once, then renders the `#defer` blocks that load or idle in the same response. |
| `pageCache`   | `boolean`                   | Keeps the pages that `cache` makes public in the store of `cached`. Defaults to true. See [Caching pages](./routing.md#caching-pages).                  |
| `dev`         | `boolean`                   | Throws errors that are not a `ServerError` instead of rendering `_error.brm`, so a dev server can show them. The plugin sets it in development.         |

`RequestOptions` is what `handleRequest` takes too, and `handleRoute` adds it to its own options:

| Option           | Type                              | Meaning                                                                                                                                      |
| ---------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `origins`        | `string[]`                        | Other origins that may call server functions and post forms to them. The origin of the request is always allowed.                            |
| `middleware`     | `EntryMiddleware`                 | The middleware of the entry, which runs before anything else.                                                                                |
| `fileMiddleware` | `Record<string, EntryMiddleware>` | The middleware of each `'use server'` file, by function ID. It runs before the function, after the middleware of the entry.                  |
| `onError`        | `ServerErrorHandler`              | Gets each error of the server that is not a `ServerError`, in place of `console.error`.                                                      |
| `onTrace`        | `TraceHandler`                    | Gets each span of the work of the server. See [Observability](./observability.md#on-the-server).                                             |
| `waitUntil`      | `(promise) => void`               | What `event.waitUntil` passes its promises to.                                                                                               |
| `build`          | `string`                          | The ID of the build, for skew protection. A call from a page of another build to a function that is gone answers 409 with `x-brumate-build`. |
| `address`        | `string`                          | The address of the client, for `clientAddress` and rate limits.                                                                              |
| `prerender`      | `boolean`                         | True while the build prerenders the pages. Rate limits do not count then.                                                                    |

### `RenderResult`

| Field     | Type                    | Meaning                                                                                              |
| --------- | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `html`    | `string`                | The markup. A `#loading` body that is not ready shows its fallback.                                  |
| `head`    | `string`                | Markup for the head: the title and the `#head` blocks.                                               |
| `state`   | `string`                | The script that holds the page state.                                                                |
| `pending` | `AsyncIterable<string>` | Markup to send after the page as it is ready: `#loading` bodies and the values that settle promises. |
| `headers` | `Headers`               | Headers and cookies that the page set on its event while it rendered.                                |
| `status`  | `number`                | The status that `event.setStatus` set, or 200.                                                       |
| `next()`  | `() => number`          | A number above every ID of the render, for the `base` of another root.                               |

### `virtual:brumate/routes`

The Vite plugin builds this module from the files of `src/routes`. It exports `routes`, the route tree, and `handle(request, options?)`. `handle` calls `handleRoute` with the tree and these settings of the plugin: `rpc`, `origins`, `functions`, `fileMiddleware`, the entry middleware, `onError` and `onTrace`, `build`, `hints` and `bundleHints`. It returns a promise of a `Response`, or `undefined` when no route matches and there is no root `_error.brm`.

`options` is typed as `RouteOptions`. What you pass wins over the settings of the plugin. `handle` adds to it:

- **Scripts.** Without `scripts`, `handle` sends the script tags of the client, with the `nonce` of the options on each. In development they are the Vite client and the client entry, which is the first input of the client build that is not an HTML page. An app with no entry gets `virtual:brumate/start`. The dev tags follow `base`. In a build, the tag is the entry of the client build, read from its manifest, with `async`.
- **Client build.** A server build that uses the routes fails when the client build is missing. The client build writes `.vite/manifest.json` unless `build.manifest` names another file. A client built to a directory other than `dist/client` (or the output of the client environment) needs the `clientOutDir` option of the plugin.
- **Shells.** Under Nitro with `prerender`, a page with `#defer` blocks is a server asset. `handle` reads it as the `shell` when you pass none. Its script tags get the `nonce` of the request. A `shell` that you pass is sent as given.

See [Deploying](./deploying.md#the-script-tags) and [Plugin options](./reference-plugin.md).

### Route types

`Handler`, `Middleware`, `EntryMiddleware`, `RouteNode` and the other types of the route tree are exported too. See [Route files](./reference-routes.md).

## `brumate/env`

`defineEnv(schema, options?)` checks the environment variables of the app when the server starts, and returns their values with their types. The browser gets the public ones only. See [Environment variables](./environment.md).

## `brumate/routes`

| Export                       | What it does                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `href(path, params?)`        | The URL of a route: `href('/todos/[id]', { id: '3' })` is `/todos/3`. Params are encoded. A rest param keeps its slashes. A missing param throws. |
| `RouteParams<'/todos/[id]'>` | The type of the params of a route path.                                                                                                           |
| `RoutePath`                  | The type of a route path. Any string until the plugin writes the route types.                                                                     |
| `Routes`                     | The interface that the generated declaration file fills with the paths of the routes.                                                             |
| `navigate(href, options?)`   | Loads a page as a link does, and returns when it shows. `replace` replaces the entry of the history, and `scroll: false` keeps the place.         |

## `brumate/context`

| Export                              | What it does                                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `createContext<T>(key): Context<T>` | Creates a context. `key` names it in the page state, so it must be unique in the app. It has no default value. |

See [Context](./context.md).

## `brumate/html`

| Export      | What it does                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `raw(html)` | Marks a string as HTML, so `{raw(html)}` inserts it without escaping. Insert only HTML you trust. |

## `brumate/loader`

`start(options)` takes `onError(error, info)`, which receives every error of client code first, before the nearest `#try` renders its `#catch` body or the page gets a `brumate:error` event. A memo error that a `#try` catches does not reach it. See [Errors in the browser](./effects.md#errors-in-the-browser).

```ts
import { start } from 'brumate/loader';
import { load } from 'virtual:brumate/manifest';

const stop = start({ load, rpc: '/_brumate', navigate: true });
```

`virtual:brumate/start` does this for you. Use `start` to add to `load`, or to start the loader of a page that another tool renders.

| Option     | Type                                    | Meaning                                                                                    |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `load`     | `(id: string) => Promise<ClientModule>` | Imports the client module of a component, by component ID.                                 |
| `rpc`      | `string`                                | The URL prefix of server function calls. Defaults to `/_brumate`.                          |
| `navigate` | `boolean \| { transition?, focus? }`    | Client navigation, view transitions and focus. Defaults to `true`.                         |
| `onError`  | `(error, info) => void`                 | Receives every error of client code first.                                                 |
| `onTrace`  | `TraceHandler`                          | Receives the spans of the browser. See [Observability](./observability.md#in-the-browser). |
| `build`    | `string`                                | The ID of the build, for skew protection. The plugin sets it.                              |
| `serial`   | `() => Promise<SerialEntry>`            | Imports the serial entry, which the core takes before it reads the page state.             |

`navigate.transition` swaps the page inside a view transition, where the browser has them. `navigate.focus` moves the focus to the first `<h1>` of the routes that changed, or to `<main>`, after a navigation, and defaults to `true`. `load` may return `undefined` for a component that has no client code.

`start` returns a function that stops the loader and removes its listeners. After it stops, code that finishes loading later does not link the page's scopes to module stores, render a block or show an error.

`brumate/static-loader` exports `startWithoutNavigation`, which takes the same options and never loads pages in place. A bundle that imports only it has none of the code of client navigation. The plugin uses it with `navigate: false`. `brumate/loader` exports it too, but a bundle that imports `brumate/loader` keeps the parts of the core that navigation reads.

## `brumate/testing`

`virtual:brumate/testing` exports `mount`, already connected to the client modules of the project. `brumate/testing` exports `createMount(options)`, which makes one from `load` and `rpc`.

`virtual:brumate/testing` exports `visit(path, options?)` too, which loads a route of the app in the test with its layouts, middleware and client navigation. `brumate/testing` exports `createVisit(options)`, which makes one from `load`, `rpc`, and `routes` and `calls`, two functions that answer requests. See [Testing server functions and routes](./testing-server.md).

`virtual:brumate/testing` exports `answerCalls(options?)` too. It answers the server function calls of the page with `functions` of `virtual:brumate/server`, and returns a function that restores `fetch`. `brumate/testing` exports `answerCalls(functions, options?)`, which takes the functions by ID, or a function that returns a promise of them.

| Option                                    | Type                   | What it does                                                                                                            |
| ----------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `rpc`                                     | `string`               | The URL prefix of calls. Defaults to `/_brumate`.                                                                       |
| `onCall`                                  | `(id: string) => void` | Gets the ID of each call, before the function runs.                                                                     |
| `middleware`, `onError`, `fileMiddleware` |                        | The entry middleware, its `onError` and the middleware of each file. `virtual:brumate/testing` passes those of the app. |

```ts
const page = await mount(Component, props, renderOptions?);
```

`renderOptions` are the options of `render`, and `offscreen`, a selector of elements that stay out of view until `reveal` brings them in.

| Member                         | What it does                                                 |
| ------------------------------ | ------------------------------------------------------------ |
| `container`                    | The element that holds the component.                        |
| `get(selector)`                | The first element that matches, or an error.                 |
| `text(selector)`               | The text of the first element that matches.                  |
| `click(selector)`              | Clicks an element.                                           |
| `input(selector, value)`       | Types a value into a field and fires `input`.                |
| `submit(selector)`             | Submits a form.                                              |
| `reveal(selector)`             | Brings elements that `offscreen` kept out of view into view. |
| `checkAccessibility(options?)` | Runs axe-core and throws with each violation.                |
| `waitFor(assertion, timeout?)` | Retries an assertion until it passes, 2000 ms by default.    |
| `unmount()`                    | Stops the loader and removes the component.                  |

See [Testing](./testing.md).

## `brumate/devtools`

`installDevtools(endpoint = '/__brumate/inspect')` adds the devtools grip to a page. The plugin calls it on the dev server for every client entry that starts the loader, so you do not. A call of your own is harmless: a second install does nothing. See [Inspect and devtools](./inspect.md#devtools).

## `brumate/hot`

`hotLoad(import.meta.hot, load)` returns a `load` for the loader that loads the new code of a component that changed on the dev server, and replaces its styles. The plugin wraps the `load` of every client entry that calls `start` from `brumate/loader`, so you do not call it. A call of your own is harmless: a load that is wrapped stays as it is. It stays exported for code that starts the loader some other way.

Outside the dev server, `import.meta.hot` is undefined and `hotLoad` returns `load` as it is. See [Edit while it runs](./getting-started.md#edit-while-it-runs).
