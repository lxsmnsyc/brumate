# Runtime API

The modules that app code imports, other than `brumate/signals`. Most apps use only the request helpers of `brumate/server`, `href` and `createContext`. The rendering functions are for a custom server.

| Module                  | For                                                                      |
| ----------------------- | ------------------------------------------------------------------------ |
| `brumate/server`        | Server functions and rendering: the request, errors, redirects, streams. |
| `brumate/routes`        | Links to routes.                                                         |
| `brumate/context`       | Contexts.                                                                |
| `brumate/html`          | Raw HTML.                                                                |
| `brumate/loader`        | Starting the loader by hand.                                             |
| `brumate/static-loader` | Starting the loader by hand, without client navigation.                  |
| `brumate/testing`       | Component tests.                                                         |
| `brumate/vite`          | The Vite plugin. See [Plugin options](./reference-plugin.md).            |
| `brumate`               | The compiler. See [Plugin options](./reference-plugin.md#compiler-api).  |

`brumate/client` is the core that the loader loads. Compiled code calls it, and apps do not.

## `brumate/server`: in server functions

`getEvent()` returns the `RequestEvent` of the request being handled. Call it in a server function, middleware or an endpoint before their first `await`, or anywhere in a component's script while a page renders with a request. Elsewhere it throws. See [The request](./server-functions.md#the-request).

| `RequestEvent` member                   | What it does                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `request`                               | The web `Request`.                                                                                              |
| `headers`                               | Headers to add to the response.                                                                                 |
| `setStatus(status)`                     | The status of the page response, such as 404. Works during the first render of a page only.                     |
| `refresh(fn)`                           | Asks the browser to load again the memos that call the server function `fn`.                                    |
| `getCookie(name)`, `getCookies()`       | Cookies of the request, with the ones that this request set.                                                    |
| `setCookie(name, value, options?)`      | Sets a cookie: `HttpOnly`, `SameSite=Lax` and path `/` unless the options say otherwise, and `Secure` on HTTPS. |
| `deleteCookie(name, { path, domain }?)` | Deletes a cookie.                                                                                               |

| Export                                       | What it does                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `getEvent(): RequestEvent`                   | The event of the request being handled.                                                                           |
| `redirect(location, status = 303): never`    | Stops and sends the browser to `location`.                                                                        |
| `isRedirect(error): boolean`                 | True for the error that `redirect` throws.                                                                        |
| `new ServerError(message, { status = 400 })` | An error whose message and status reach the browser. Other errors reach it as a generic message with status 500.  |
| `createSession<T>({ secret, name, maxAge })` | A session in a signed cookie, with `get(event)`, `set(event, data)`, `update(event, change)` and `clear(event)`.  |
| `withEvent(event, callback)`                 | Runs a callback with an event, so `getEvent()` before its first `await` returns it. For custom servers and tests. |

See [Server functions](./server-functions.md) and [Cookies and sessions](./server-functions.md#cookies-and-sessions).

### Validation

These check values with any [Standard Schema](https://standardschema.dev), such as a schema of Zod, Valibot or ArkType. See [Validating arguments](./server-functions.md#validating-arguments) and [Validating a form](./forms.md#validating-a-form).

| Export                                               | What it does                                                                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `parse(schema, value): Promise<T>`                   | The output of the schema. A value that does not match throws a `ValidationError` with status 400.                            |
| `safeParse(schema, value)`                           | `{ value }` or `{ issues }`, without throwing.                                                                               |
| `parseForm(schema, form)`                            | Turns the fields of a `FormData` into an object, and returns `{ value }` or `{ issues }`, without throwing.                  |
| `fieldErrors(issues)`                                | The messages by field: `Record<string, string[]>`, keyed by the path joined with dots. Issues without a path are under `''`. |
| `ValidationError`                                    | The `ServerError` that `parse` throws. Its `issues` stay on the server.                                                      |
| `StandardSchemaV1`, `ValidationIssue`, `ParseResult` | The types of a schema, of an issue as plain data, and of the result of `safeParse` and `parseForm`.                          |

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
| `createContext(key, defaultValue)`                                  | The same as in `brumate/context`.                                                                                                         |

### `RenderOptions`

The options of `render`, and of every function that renders.

| Option    | Type                    | Meaning                                                                                                              |
| --------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `request` | `Request`               | The request of the page, so `getEvent()` works while it renders.                                                     |
| `rpc`     | `string`                | The URL prefix of server function calls, for forms. Defaults to `/_brumate`.                                         |
| `nonce`   | `string`                | A Content Security Policy nonce for the inline scripts: the state records and the swap scripts of `#loading` bodies. |
| `base`    | `number`                | The first ID of the render, for a second root on the same page.                                                      |
| `actions` | `Map<unknown, unknown>` | Results of server functions that a form posted to this page, by function, for `$action`.                             |
| `route`   | `string`                | Names the route of the page. `handleRoute` sets it.                                                                  |

### `DocumentOptions`

The options of `renderToStream`, `streamParts` and `handleRoute` add these to `RenderOptions`:

| Option    | Type                                   | Meaning                                                                             |
| --------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| `scripts` | `string`                               | Markup after the page state, such as the client entry. Make module scripts `async`. |
| `head`    | `string`                               | Markup for the head, before the head of the components, such as a `<link>`.         |
| `start`   | `string \| ((head: string) => string)` | Markup before the component, for a component that does not render `<html>`.         |
| `end`     | `string`                               | Markup after the first render, for a component that does not render `<html>`.       |

`handleRoute` also takes `functions`, the server functions by ID, `origins`, `hints`, the URLs of the modules that every page loads, and `earlyHints`, a callback that receives them as `Link` values before the page renders. See [Early hints](./deploying.md#early-hints).

### `RenderResult`

| Field     | Type                    | Meaning                                                                                              |
| --------- | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `html`    | `string`                | The markup. A `#loading` body that is not ready shows its fallback.                                  |
| `head`    | `string`                | Markup for the head: the `$title` and the `#head` blocks.                                            |
| `state`   | `string`                | The script that holds the page state.                                                                |
| `pending` | `AsyncIterable<string>` | Markup to send after the page as it is ready: `#loading` bodies and the values that settle promises. |
| `headers` | `Headers`               | Headers and cookies that the page set on its event while it rendered.                                |
| `status`  | `number`                | The status that `event.setStatus` set, or 200.                                                       |
| `next()`  | `() => number`          | A number above every ID of the render, for the `base` of another root.                               |

### Route types

`Handler`, `Middleware`, `RouteNode` and the other types of the route tree are exported too. See [Route files](./reference-routes.md).

## `brumate/routes`

| Export                       | What it does                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `href(path, params?)`        | The URL of a route: `href('/todos/[id]', { id: '3' })` is `/todos/3`. Params are encoded. A rest param keeps its slashes. A missing param throws. |
| `RouteParams<'/todos/[id]'>` | The type of the params of a route path.                                                                                                           |
| `RoutePath`                  | The type of a route path. Any string until the plugin writes the route types.                                                                     |
| `Routes`                     | The interface that the generated declaration file fills with the paths of the routes.                                                             |

## `brumate/context`

| Export                                            | What it does                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `createContext<T>(key, defaultValue): Context<T>` | Creates a context. `key` names it in the page state, so it must be unique in the app. |

See [Context](./context.md).

## `brumate/html`

| Export      | What it does                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `raw(html)` | Marks a string as HTML, so `{raw(html)}` inserts it without escaping. Insert only HTML you trust. |

## `brumate/loader`

```ts
import { start } from 'brumate/loader';
import { load } from 'virtual:brumate/manifest';

const stop = start({ load, rpc: '/_brumate', navigate: true });
```

`virtual:brumate/start` does this for you. Use `start` to add to `load`, or to start the loader of a page that another tool renders.

| Option     | Type                                    | Meaning                                                                                                                                                        |
| ---------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `load`     | `(id: string) => Promise<ClientModule>` | Imports the client module of a component, by component ID.                                                                                                     |
| `rpc`      | `string`                                | The URL prefix of server function calls. Defaults to `/_brumate`.                                                                                              |
| `navigate` | `boolean \| { transition?: boolean }`   | Client navigation, and view transitions. Defaults to `true`.                                                                                                   |
| `preload`  | `boolean`                               | Loads the code of handlers near the viewport while the browser is idle after `load`. Defaults to `true`. See [Idle preload](./client-modules.md#idle-preload). |

`start` returns a function that stops the loader and removes its listeners.

`brumate/static-loader` exports `startWithoutNavigation`, which takes the same options and never loads pages in place. A bundle that imports only it has none of the code of client navigation. The plugin uses it with `navigate: false`. `brumate/loader` exports it too, but a bundle that imports `brumate/loader` keeps the parts of the core that navigation reads.

## `brumate/testing`

`virtual:brumate/testing` exports `mount`, already connected to the client modules of the project. `brumate/testing` exports `createMount(options)`, which makes one from `load` and `rpc`.

`virtual:brumate/testing` exports `answerCalls(options?)` too. It answers the server function calls of the page with `functions` of `virtual:brumate/server`, and returns a function that restores `fetch`. `brumate/testing` exports `answerCalls(functions, options?)`, which takes the functions by ID, or a function that returns a promise of them.

| Option   | Type                   | What it does                                        |
| -------- | ---------------------- | --------------------------------------------------- |
| `rpc`    | `string`               | The URL prefix of calls. Defaults to `/_brumate`.   |
| `onCall` | `(id: string) => void` | Gets the ID of each call, before the function runs. |

```ts
const page = await mount(Component, props, renderOptions?);
```

| Member                         | What it does                                              |
| ------------------------------ | --------------------------------------------------------- |
| `container`                    | The element that holds the component.                     |
| `get(selector)`                | The first element that matches, or an error.              |
| `text(selector)`               | The text of the first element that matches.               |
| `click(selector)`              | Clicks an element.                                        |
| `input(selector, value)`       | Types a value into a field and fires `input`.             |
| `submit(selector)`             | Submits a form.                                           |
| `waitFor(assertion, timeout?)` | Retries an assertion until it passes, 2000 ms by default. |
| `unmount()`                    | Stops the loader and removes the component.               |

See [Testing](./testing.md).

## `brumate/devtools`

`installDevtools(endpoint = '/__brumate/inspect')` adds the devtools button to a page. The dev server calls it. See [Inspect and devtools](./inspect.md#devtools).

## `brumate/hot`

`hotLoad(import.meta.hot, load)` returns a `load` for the loader that loads the new code of a component that changed on the dev server, and replaces its styles. The start module of the plugin uses it. A custom client entry that calls `start` itself passes it:

```ts
import { hotLoad } from 'brumate/hot';
import { start } from 'brumate/loader';
import { load } from 'virtual:brumate/manifest';

start({ load: hotLoad(import.meta.hot, load) });
```

Outside the dev server, `import.meta.hot` is undefined and `hotLoad` returns `load` as it is. See [Edit while it runs](./getting-started.md#edit-while-it-runs).
