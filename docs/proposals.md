# Proposals

Features that would be good to add, with the reason for each, a sketch, and a rough cost. None of them is decided. [Decisions](./decisions.md) lists what is.

## Summary

| Proposal                                                              | Area    | Value  | Cost   |
| --------------------------------------------------------------------- | ------- | ------ | ------ |
| [Two-way binding](#two-way-binding)                                   | Syntax  | Medium | Small  |
| [Blocking async memos](#blocking-async-memos)                         | Data    | Medium | Medium |
| [Errors in client code](#errors-in-client-code)                       | Runtime | High   | Medium |
| [Routing in the browser](#routing-in-the-browser)                     | Routing | High   | Small  |
| [Caching pages and data](#caching-pages-and-data)                     | Server  | High   | Medium |
| [Rate limiting](#rate-limiting)                                       | Server  | High   | Small  |
| [Two-way realtime](#two-way-realtime)                                 | Server  | Medium | Medium |
| [Embedding in other sites](#embedding-in-other-sites)                 | Build   | Medium | Medium |
| [Transitions](#transitions)                                           | Syntax  | High   | Medium |
| [Element behaviors](#element-behaviors)                               | Syntax  | High   | Small  |
| [Long lists](#long-lists)                                             | Syntax  | Medium | Medium |
| [Timing helpers](#timing-helpers)                                     | Data    | Low    | Small  |
| [Persisted signals](#persisted-signals)                               | Data    | Low    | Small  |
| [Worker functions](#worker-functions)                                 | Runtime | Medium | Medium |
| [Offline pages](#offline-pages)                                       | Runtime | Medium | Medium |
| [Observability](#observability)                                       | Runtime | Medium | Medium |
| [Early hints](#early-hints)                                           | Runtime | Medium | Small  |
| [Testing routes](#testing-routes)                                     | Tooling | High   | Small  |
| [Budgets for one event](#budgets-for-one-event)                       | Tooling | Medium | Small  |
| [Content mappers for TypeScript 7](#content-mappers-for-typescript-7) | Tooling | High   | Medium |
| [Deployment adapters](#deployment-adapters)                           | Build   | Medium | Medium |
| [Headless UI components](#headless-ui-components)                     | Library | High   | Large  |
| [Progressive forms](#progressive-forms)                               | Library | High   | Medium |
| [Markdown with components](#markdown-with-components)                 | Library | Medium | Medium |
| [Compiled messages for i18n](#compiled-messages-for-i18n)             | Library | Medium | Small  |

## Syntax

### Two-way binding

Fields repeat the same pair of attributes:

```html
<input value=draft onInput=((event) => (draft = event.currentTarget.value))>
```

A `bind:` attribute writes it once:

```html
<input bind:value=draft>
<input type="checkbox" bind:checked=done>
<select bind:value=choice>…</select>
```

- `bind:value` and `bind:checked` compile to the attribute and the handler above. The handler is a client root like any other, so it loads on the first input.
- The target must be a signal, so the compiler checks the write.

### Transitions

View transitions animate a change of page. Inside a page, an `#if` or `#for` body shows and goes at once, because the node is gone before CSS can animate it.

```html
#if (open) {
  <div class="panel" transition=fade(200)>…</div>
}
#for (todo of todos by todo.id) {
  <li animate=flip(150)>{todo.title}</li>
}
```

- `transition=fn` on an element of a body runs `fn(element, 'in' | 'out')` when the body shows or goes, and the client removes the element when the returned promise settles. A transition that CSS does alone can be a class: `transition="fade"` adds `fade-in` and `fade-out`, as the `Transition` of Terracotta does.
- `animate=fn` on the element of a list item moves it from its old place to its new one when the list changes order.
- The server renders the elements as they are. A transition runs only for a change in the browser, so the first render shows no animation, and the code loads with the update that changes the block.
- `brumate/transition` brings `fade`, `slide`, `scale` and `flip`, with the Web Animations API. `prefers-reduced-motion` turns them off.
- The `Transition` of the UI components, in phase 2, builds on it.

Cost: about 1 to 2 weeks. The client already removes a body in one place, which waits for the transition.

### Element behaviors

A behavior that belongs to an element, such as a tooltip, a click outside, a field that grows with its text, or a chart library, needs a `ref` signal and an `$effect` in each component that uses it.

```html
<script>
  import { autosize, clickOutside } from './behaviors';
</script>

<textarea use=autosize></textarea>
<div use=(clickOutside(() => (open = false)))>…</div>
```

- `use=fn` calls `fn(element)` in the browser, and the function it returns when the element goes. A behavior with an argument is a function that returns one.
- It is a client root, as a `$client` callback is, with the same triggers: it loads when the element comes into view by default, or with `use:idle` and `use:load`.
- The server renders the element, so a behavior only adds to it. Without scripts, the element works as plain HTML.

Cost: a few days. It is `$client` with an element.

### Long lists

A long list renders every item on the server and in the browser. A windowed list renders only the items in view, and the browser renders the rest as the user scrolls.

```html
#for (row of rows by row.id) window(48) {
  <tr>…</tr>
}
```

- `window(height)` gives the height of an item, so the list knows which items are in view. The server renders the first items and a spacer for the rest, so the page has the right height and the first items show without scripts.
- The browser renders the items that come into view from the render module, and removes those that leave. Items keep their scopes while they are in the list, so state inside them stays.
- Items of different heights measure themselves once rendered.
- The `Virtualizer` of the UI components, in phase 6, becomes this block.

Cost: about 2 weeks, most of it for scrolling, focus and the items of different heights.

## Data

### Blocking async memos

`await` says where the server waits instead of streaming. A read with `await` gives the value, never a promise and never a fallback, so the state holds the value and needs no later record for it:

```html
<script>
  import { $memo, $props } from 'brumate/signals';
  import { fetchSettings, fetchUser, listTags } from './data.server';

  const { id } = $props<{ id: string }>();
  // The server waits here. A constant: it does not load again on the client.
  const settings = await fetchSettings();
  // A memo that the page waits for. It loads again when `id` changes.
  const user = $memo(fetchUser(id));
  // A memo that streams, unless an `await` reads it.
  const tags = $memo(listTags());
</script>

<p>{settings.theme}</p>
#loading {
  <!-- The page waits for the user. The tags can show the fallback. -->
  <h1>{(await user).name}</h1>
  <p>{tags.join(', ')}</p>
} #else {
  <p>Loading…</p>
}
<button onClick=(() => console.log(tags))>Log tags</button>
```

The page waits for `user`. Then, if `tags` is ready too, the body renders in place, with no fallback and no swap. If `tags` is still loading, the page shows the fallback, and the body streams in when `tags` arrives.

Where `await` can be, and what it waits for:

- In a script, `await` of a promise or of a call that returns one, as in JavaScript. The script runs only on the server, so the value is a constant that the state sends when client code reads it. This works today, except in the browser.
- `const name = await $memo(value)` declares a memo that the page waits for where it is declared. It is a memo like any other on the client: it loads again when what it reads changes. Its value is in the first state record, even when only client code reads it.
- `await name` of a memo, in a script, an insert, an attribute, a prop or a block header, waits for the memo in the render around it, and never shows a fallback for it:
  - Outside every `#loading` and `#defer` body, the page waits, so the memo is in the first state record.
  - Inside a `#loading` body, the render around the block waits for the memo before it reaches the block: the page, for a block at the top, or the body of a `#loading` around it.
  - Inside a `#defer` body, the request for the body waits.
- `$memo(await value)` keeps its meaning: a memo whose value loads. Without an `await` of the memo itself, it streams when only client code or a `#loading` body reads it, as now.

Reads without `await`:

- Inside a `#loading` body, a read of a memo that is still loading shows the fallback, and the body streams in when the memo arrives.
- Outside every body there is no fallback, so a read still makes the page wait, as now. A lint can suggest `await` there, so the wait shows in the code.

A `#loading` body renders in place when it can:

- After the memos that it reads with `await` settle, the server checks the other memos that the body reads. When all of them are ready, the body renders where the block is, with no fallback, no `<template>` and no swap.
- It renders in its own ID space, such as `5.0`, as a body that streams does, so its IDs are the same either way. Its scopes are in the first state record.
- Otherwise the block renders as now: the fallback, and the body later.
- This also changes the HTML of a `#loading` block today whose data happens to be ready: it renders in place.

In the browser:

- The value of a memo is already settled when the code that reads it runs, so `await name` of a memo compiles to a plain read. An insert shows the last value while the memo loads again, and `$isPending` tells when it does.
- A render module runs without waiting, so it cannot wait for a promise. Code that the browser renders, such as a branch of an `#if` that changes, cannot `await` anything other than a memo. The compiler reports it in the same file. A component whose script awaits a promise renders only on the server, and throws a clear error when the browser renders it, such as from another file.

Order:

- Awaits of promises in a script run in order, as in JavaScript.
- A run of `await $memo(…)` declarations, one after another, starts every memo of the run, then waits for all of them where the run ends: before the next statement, and before any markup. Independent memos load at the same time.
- A memo that reads another one waits for it by itself. On the server, the read of a memo that is still loading throws `NotReady` with its load, and `wait` computes the memo again once that load settles. So in `const a = await $memo(foo()); const b = await $memo(bar(a))`, `bar(a)` starts when `foo()` settles:

```js
const $$p_a = $$b.memo(() => foo(), $$ctx);
const $$p_b = $$b.memo(() => bar($$b.read($$p_a)), $$ctx);
// The end of the run: every memo of it loads, and the render waits for all of them.
await Promise.all([$$b.wait($$p_a), $$b.wait($$p_b)]);
const a = $$b.read($$p_a);
const b = $$b.read($$p_b);
```

- Another statement ends the run, so code between two declarations sees the first memo settled, as it would in JavaScript.
- When a memo fails, the memos that read it do not run, and the error comes where the run waits.
- In the browser nothing changes: `b` reads `a`, so it loads again when `a` changes, as any memo that reads another.

What it needs:

- The analyzer marks memos that `await $memo(…)` declares, and memos read with `await`, as blocking for the render around their read. `blockingMemos` already decides which memos the server awaits where they are declared.
- The `#loading` emitter awaits the memos that its body reads with `await` before the block, checks whether the other memos are ready, and renders the body in place or streams it.
- The client codegen removes `await` from reads of memos, and reports `await` of anything else in code that runs in the browser.
- The type checker types `await name` of a memo as its value.
- With every promise awaited, a page with no `#loading` or `#defer` body has one state record, and gets the smaller state that assigns only shared references.

Prior art: Svelte 5 lets `await` appear in `$derived` and in markup, and the nearest boundary shows its pending content.

Cost: about 1 week. The server side exists, and most of the work is the client side of `await` and its errors.

### Timing helpers

A search field that waits for a pause in typing needs a timer, an `$effect` and a second signal, written by hand each time.

```html
<script>
  import { $debounced, $memo, $signal } from 'brumate/signals';

  let query = $signal('');
  const settled = $debounced(query, 300);
  const results = $memo(search(settled));
</script>
```

- `$debounced(value, ms)` is a memo that takes the value after it stops changing for `ms`. `$throttled(value, ms)` takes it at most once every `ms`.
- On the server, both are the value itself, so the page renders the results for the query it has.
- They are client roots of their own, so their timers load with the first change.

Cost: a few days.

### Persisted signals

Preferences such as the theme, a dismissed banner or the width of a panel are written to `localStorage` or a cookie by hand, and read back in `$client`, so the page renders the default first and then changes.

```html
<script>
  import { $persisted } from 'brumate/signals';

  let theme = $persisted('theme', 'light', { in: 'cookie' });
</script>
```

- `$persisted(key, initial, { in })` is a signal whose writes go to `localStorage`, `sessionStorage` or a cookie.
- With a cookie, the server reads the value from the request, so the page renders the right theme at once, with no flash.
- With storage, the server renders `initial`, and the browser reads the stored value when the page resumes.
- A write in another tab updates the signal, through the `storage` event.

Cost: a few days.

## Runtime

### Errors in client code

A `#try` catches an error while its body renders, on the server or on the client. An error in code that runs later in the browser does not reach it. A handler that throws leaves an unhandled rejection, and an async memo that fails logs the error and becomes `undefined`.

Errors in client code would go to the component that owns the code:

- Event handlers, `$effect` and `$client` callbacks, the functions that they call, and the loads of async memos.
- The error goes to the nearest `#try` around the scope that the code belongs to, through the parents and the owners of scopes, as contexts are found. That `#try` renders its `#catch` body in the browser, with the error and `reset`.
- Without a `#try` around it, the core dispatches a `brumate:error` event on `window` with the error and the scope, and logs it. An app can report it from there.
- A loader option, `onError(error, info)`, receives every error first, such as for a reporting service.

What it needs:

- The client render code of each `#catch` body that client code inside its `#try` can reach. Today a `#catch` body ships only when its `#try` can fail while it renders on the client. Every `#try` with a handler inside would ship its `#catch` body.
- A `#try` that catches from client code needs a marker in the page even when its body never renders on the client.
- Async handlers: the error of the promise that a handler returns counts too.
- `reset()` renders the `#try` body again, as it does now.

Cost: about 1 to 2 weeks. The scope tree and the `#try` swap exist. Most of the work is deciding which `#catch` bodies ship, and testing the order of errors and cleanups.

### Worker functions

Heavy work, such as parsing a large file, building a search index or processing an image, blocks the page when it runs in a handler.

```ts
// search.worker.ts
export function buildIndex(documents: Document[]) {
  'use worker';
  return createIndex(documents);
}
```

- A worker function runs in a Web Worker. The browser calls it like a server function, and gets a promise of its result.
- It uses the calls and the serializer of server functions, and the stubs of [two-way realtime](#two-way-realtime): functions in its arguments and its result become stubs, so a worker can report its progress or return an object with methods that stay in the worker.
- The worker loads on the first call, with only the code of its functions.
- On the server, a worker function runs in place, or in a worker thread with an option.

Cost: about 1 to 2 weeks, after the stubs of two-way realtime. Without them, a few days for calls with values only.

### Offline pages

A resumed page needs the network only for the parts that its handlers load. The idle preload already knows which parts a page can reach.

- A generated service worker caches the page, the loader, the core and those parts, so a page that was loaded once works offline, and its handlers run.
- A server function call made offline waits in a queue with an option, and goes when the connection comes back. Its result settles the same promise.
- `$online` is a signal of the connection, for a page that shows that it is offline.
- A page that was never loaded shows the offline page of the app.

Cost: about 2 weeks, most of it for updates of the service worker and for which calls are safe to queue.

### Observability

The benchmarks measure renders and loads, but an app cannot see them.

- On the server, `onTrace(span)` receives the time of each render, each memo load, each server function call and each `#defer` request, with the component and the route. A small adapter turns them into OpenTelemetry spans.
- In the browser, `onTrace` receives the time from an event to its handler, split into the parts it loaded and the run, so a slow first click shows where its time went.
- The traces are off unless the option is set, and cost nothing then.

Cost: about 1 week.

### Early hints

A first click after `load` waits for the core and the part of its handler. The server knows the loader and the core before it renders the page.

- The server sends `103 Early Hints` with `modulepreload` links for the loader and the core, or the same links at the start of the HTML where a host does not pass early hints on.
- With the build report, it can also hint the parts of the handlers that are most likely to run first, such as those of the first viewport.
- It cuts a round trip from the cold click of the benchmark: 243 ms for brumate against 55 ms for Marko 6, which ships its code in the page.

Cost: a few days.

## Routing

### Routing in the browser

Client navigation follows links and forms, but code cannot start it, and the browser cannot read the route. The params and the query string are only on the server, through `getEvent().request.url`. A filter, a tab or a page number that lives in the URL needs a link for every change, and the browser cannot read it back.

```html
<script>
  import { $signal } from 'brumate/signals';
  import { $route, href, navigate } from 'brumate/routes';
  import { createIssue } from '../issues.server';

  const route = $route('/issues');
  let query = $signal(route.search.get('q') ?? '');

  async function save() {
    const issue = await createIssue(query);
    await navigate(href('/issues/[id]', { id: issue.id }));
  }
</script>

<input value=query onInput=((event) => navigate(`?q=${event.currentTarget.value}`, { replace: true }))>
<p>Page {route.search.get('page') ?? '1'}</p>
```

- `navigate(href, { replace, scroll })` loads a page as a link does: layouts that stay keep their state. It returns when the page shows. A URL on another origin loads the page.
- `$route(path)` gives `{ params, search }` for the route at `path`, typed from the route files as `href` is. The server reads the request, and the browser reads `location`, so both render the same value.
- `$route` is a memo on the client. It changes when navigation changes the URL, so code that reads it updates, without the server.
- A change of only the query string, with `replace`, can skip the server when no route reads anything but `$route`. The compiler knows which routes read data, so it can tell.

Cost: a few days for `navigate` and `$route`, which reuse client navigation. Skipping the server for a query string change is a week more, and can come later.

## Server

### Caching pages and data

A response can set its own headers, through `event.headers`, but there is nothing between one request and the next. Each request renders the page and loads its data again. `#defer` makes caching more useful: the page can be cached for everyone, and its parts for one user render later.

- A route sets how long its page can be cached, with an export of its file:

```html
<script module>
  export const cache = { maxAge: 60, staleWhileRevalidate: 600 };
</script>
```

The server sends `cache-control` from it, and a page cache in the server, or a CDN, keeps the HTML. A page that reads the session, or sets a cookie, is never cached for everyone: the server sends `private` for it.

- A server function can cache its result across requests, by its arguments, with a time and tags:

```ts
export const listIssues = cached(async (status: string) => db.issues(status), {
  maxAge: 30,
  tags: (status) => ['issues', `issues:${status}`],
});
```

- `revalidate(tag)` drops the results and the pages that used that tag, such as after a server function changes the data. It works with `refresh(fn)`, which loads the memos of the page again in the browser.
- The cache is an interface, with an in-memory store as the default and room for Redis or a platform cache. Deployment adapters can bring their own.
- Prerendered pages are the case with no expiry. `maxAge` and `revalidate` extend them to pages that change.

Cost: about 2 weeks. Most of it is the rules for what is safe to share between users, and the tests for them.

### Rate limiting

Server functions are public endpoints: anyone can call them with `fetch`, as often as they like. A sign-in, a search or a form that sends mail needs a limit, and today each app writes its own in middleware.

```ts
import { rateLimit } from 'brumate/server';

export const signIn = rateLimit(
  async (name: string, password: string) => {
    'use server';
    // …
  },
  { max: 5, window: '1m', key: (event) => event.clientAddress },
);
```

```ts
// src/routes/api/_middleware.ts
export const middleware = rateLimit.middleware({ max: 100, window: '1m' });
```

- `rateLimit(fn, options)` wraps a server function. `max` calls in `window` for each key, and then the call answers 429 with `Retry-After`, without running the function.
- The key defaults to the address of the client, read from the request and from `X-Forwarded-For` behind a proxy that the app trusts, as the origin check reads the host. A key from the session limits a user instead, wherever they sign in from.
- `rateLimit.middleware(options)` limits every request under a folder of routes, endpoints and pages included.
- In the browser, the call rejects with a `RateLimitError`, a `ServerError` with status 429 and the time to wait, so a form can show it. A form posted without scripts gets the message, as for other errors.
- The calls of [two-way realtime](#two-way-realtime) count too, per connection and per key.
- The counters live in a store with the same interface as the cache of [caching pages and data](#caching-pages-and-data): in memory by default, which counts per process, and Redis or a platform store for an app with more than one server.
- The algorithm is a sliding window, which does not let a burst through at the edge of a fixed window.

Cost: a few days for the wrapper, the middleware and the in-memory store. The shared store comes with caching.

### Two-way realtime

Server functions can stream values to the browser, which covers updates that only go one way, such as an activity feed. Chat, presence and shared editing need calls both ways, on one connection.

A socket function is a server function that keeps a connection open. Functions in what it returns, and functions in its arguments, are not serialized. Each one becomes a stub on the other side: a function that calls its counterpart over the connection, as a small server function would.

```ts
// chat.server.ts
import { getSocket } from 'brumate/server';

export async function room(name: string, client: { message(message: Message): void }) {
  'use socket';
  const user = currentUser();
  // `client.message` is a stub: calling it calls the function that the browser passed.
  const leave = rooms.join(name, (message) => client.message(message));
  getSocket().onClose(leave);
  // These functions stay on the server. The browser gets a stub of each one.
  return {
    send(text: string) {
      rooms.post(name, { user, text });
    },
    history(): Promise<Message[]> {
      return rooms.history(name);
    },
  };
}
```

```html
<script>
  import { $client, $signal } from 'brumate/signals';
  import { room } from './chat.server';

  let messages = $signal<Message[]>([]);
  let draft = $signal('');
  let chat = $signal<Awaited<ReturnType<typeof room>>>();

  $client(() => {
    const open = room('general', { message: (message) => (messages = [...messages, message]) });
    void open.then(async (stubs) => {
      chat = stubs;
      messages = await stubs.history();
    });
    return () => void open.then((stubs) => stubs.close());
  }, 'visible');
</script>

#for (message of messages by message.id) {
  <p><b>{message.user}</b> {message.text}</p>
}
<form onSubmit:prevent=(() => { void chat?.send(draft); draft = ''; })>
  <input value=draft onInput=((event) => (draft = event.currentTarget.value))>
</form>
```

Stubs:

- A call of a stub sends its arguments over the connection, runs the counterpart, and settles with its result. Every stub returns a promise, and the types say so: a function that returns `T` becomes a stub that returns `Promise<Awaited<T>>`.
- Arguments and results go through the same serializer as server functions: values, promises, async iterables that stream, and functions again, which become stubs in turn. A stub can return a stub, so a socket can hand out more functions as the conversation goes on.
- It works both ways. The server calls the browser's functions through their stubs, such as to push a message, and the browser calls the server's.
- A stub belongs to its connection. Its ID means nothing on another connection, and a side can only call the functions that the other side gave it, so there is no route to guess, as there is for a server function.
- A call that throws rejects the caller's promise with the error's name and message, as a server function call does.
- Calls on one connection arrive in the order they were made. A caller can await a call, or not.

The connection:

- The socket function runs with the event of the request that opened the connection, so it knows the user and the cookies, and middleware runs for it. `getSocket()` gives `onClose` and `close`.
- The browser opens the connection when client code calls the socket function, not with the page, so a page that never calls it loads nothing.
- `stubs.close()`, or the end of the connection, rejects the calls that are in flight and every later call. A stub that the other side drops, such as when it is garbage collected, is released on both sides.
- When the connection drops, the browser does not open it again by itself: the stubs of the old connection are gone. A `reconnect` option can call the socket function again with the same arguments, and give the new stubs.
- On the server, while a page renders, calling a socket function calls it directly, with the functions as they are. A component can render its first value without a connection.
- The transport is WebSocket, with a fallback to the stream that server functions already use and a `POST` for each call. Deployment adapters need WebSocket for the first. Nitro has it on most hosts.

Prior art: Cap'n Web, from Cloudflare, passes functions by reference as stubs over WebSocket and HTTP. Cap'n Proto calls them capabilities.

Cost: about 3 weeks. The serializer and the call protocol of server functions exist. Most of the work is the stubs on both sides, their release, reconnection, the fallback and the adapters.

## Tooling

### Content mappers for TypeScript 7

TypeScript 7 does not load plugins, so `.brm` files get types only from TypeScript 6 and older, through `@brumate/tsc` and `@brumate/typescript-plugin`. TypeScript 7.1 adds an API for content mappers, which turn the files of other languages into TypeScript and map positions between them.

- A content mapper from `toTypeScript` would let `tsc` and the editor of TypeScript 7 check `.brm` files.
- It would replace `@brumate/tsc`, and the TypeScript plugin in the extension.
- This waits for the API to be stable, and for its documentation.

### Testing routes

`brumate/testing` mounts a component: it renders it on the server, resumes it in the DOM and clicks like a user. A route also has its layouts, its middleware, its endpoints, client navigation and `#defer` requests, which a test cannot reach.

```ts
const app = await visit(routes, '/issues', { cookies: { session } });
app.click('a[href="/issues/3"]');
await app.waitFor(() => expect(app.url).toBe('/issues/3'));
```

- `visit(routes, path, options)` answers the request with the route tree of `virtual:brumate/routes`, puts the page in the document and starts the loader with navigation.
- Links, forms, server function calls and `#defer` requests go to the same tree, in the test, without a server.
- It keeps the cookies between requests, so a test can sign in and go on.

Cost: a few days. The tests of this repository already answer routes and navigation in a DOM.

### Budgets for one event

`budget` fails the build when the loader, or the most that a route loads, goes over a size. A component can still grow one handler past what a first click should load, under the route's total.

- `budget.event` limits what one event loads: the part of its handler and the updates it runs, with what they import.
- `budget.component` limits the client code of one component.
- The error names the component, the handler and the imports that make it large, from the data that `brumate inspect` shows.

Cost: a few days.

## Build

### Deployment adapters

The server runtime uses only web APIs, and Nitro builds for each host. See `examples/nitro`.

- Nitro covers Node, Deno, Bun, Cloudflare Workers and others. Only its Node preset is tested.

### Embedding in other sites

A brumate component cannot go into a page that brumate did not render, such as a widget on a marketing site or a component in an app of another framework.

- A build target writes a component as a custom element, `<brumate-widget src="…">`, or as a script that renders it into an element.
- The element asks the server for its markup and state, as a `#defer` body does, and resumes it. The page around it needs no brumate code, only the loader, which stays under 3 kB gzip.
- Without a server, the element renders in the browser from the render module, with props from its attributes.
- Styles are scoped already. In a shadow root they stay apart from the page around them.
- Server functions answer from the brumate server, so the element works across origins with the `origins` option and CORS.

Cost: about 2 weeks. The request for markup reuses `#defer`, and most of the work is the build target and the cross-origin rules.

## Library

### Headless UI components

A package of accessible, unstyled components, `@brumate/ui`. It takes its behaviour and its way of composing parts from [React Aria Components](https://react-spectrum.adobe.com/react-aria/components.html), and its API features from [Terracotta](https://github.com/lxsmnsyc/terracotta). It is written in brumate. No React code runs.

#### What it takes from each

From React Aria Components:

- The behaviour: press handling, focus and keyboard rules, typeahead, selection in collections, overlay dismissal, and the WAI-ARIA patterns. React Aria's tests and docs are the specification. Its code is Apache-2.0, so ported parts keep its notice.
- Composition from generic parts. A `Select` is not one closed component. It is built from the same `Label`, `Button`, `Popover` and `ListBox` that work on their own:

  ```html
  <Select>
    <Label>Animal</Label>
    <Button><SelectValue /></Button>
    <Popover>
      <ListBox items=animals item=animal />
    </Popover>
  </Select>
  ```

  `Select` provides a context for each part type. Each generic part reads its context, if there is one, and merges it with its own props. Handlers are chained, and the part's own props win. A `slot` prop picks between several parts of one type, as in `<Button slot="increment">`.

From Terracotta:

- An `as` prop on every part, so it can render another element or component. It compiles to a dynamic tag, `<{as ?? 'button'} …>`.
- Render props, so the caller's markup can read the state of a part. A part calls a `#template` prop with its state, such as `{content({ open, close })}`.
- State as `data-*` attributes, such as `data-open` and `data-selected`, for styling with CSS or class objects.

#### How it maps to brumate

| React Aria Components or Terracotta | brumate                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Context provider in `Select`        | `$setContext(POPOVER, { … })` in `Select.brm`                                                                             |
| `useContextProps` in a part         | `$getContext(POPOVER)` merged with the part's props                                                                       |
| `slot` prop                         | A context value keyed by slot, read as `ctx[slot]`                                                                        |
| `triggerRef` for positioning        | CSS anchor positioning: `anchor-name` on the trigger and `position-anchor` on the popover. It needs no ref and no script. |
| Behaviour hooks                     | Functions in a `.brm.ts` module that the parts share                                                                      |
| Children as a render function       | A named `#template` prop, because `children` is markup that the server renders                                            |
| Collections from JSX children       | An `items` prop and an item `#template`, because brumate cannot read the structure of markup                              |
| Global listeners at startup         | CSS `:focus-visible` in place of focus-visible tracking. Listeners for a click outside are added when an overlay opens.   |
| `@internationalized/date`, `number` | Used as they are                                                                                                          |

Native features cover parts of the behaviour with no script: `<dialog>` with `showModal()`, the Popover API, `commandfor` and `command` on buttons, and CSS anchor positioning.

#### What the compiler needs first

1. Conditional `preventDefault`. Handlers run after their code loads, so `event.preventDefault()` in a handler is too late, and `:prevent` applies to every event of its type. Arrow keys in a list, and Enter in a combobox, need a modifier that the loader applies by key, such as `onKeyDown:prevent(ArrowDown ArrowUp Enter Escape)`, or handlers that run at once when their code is loaded.
2. Handlers in spreads. `spread()` and `attrs()` drop `on*` keys, so a part cannot put merged handlers on its element, and a wrapper cannot forward `onClick` through `...rest`. `attrs()` also keeps keys that are gone from the new object.
3. Components from packages. The Vite plugin finds `.brm` files only under the app root and skips `node_modules`, and component IDs come from the path under the root. A published package needs discovery from dependencies, and IDs that include the package name.

#### Questions to answer with a spike

Build `Select` from `Label`, `Button`, `SelectValue`, `Popover` and `ListBox` with context composition, slots, `as` and render props. It answers:

- Do parts that the caller passes as `children` read the contexts of `Select`? Children are rendered in the caller's scope and placed inside `Select`.
- What does `$getContext` return when no provider is above a part?
- Does markup that a `#template` prop rendered update when the state that the part passed to it changes?
- Can the `as` element get the part's handlers, ARIA attributes and focus, when `as` names a component?

#### Plan

1. The spike above, as a test fixture or a page in `examples/`.
2. The compiler work that the spike and the list above call for, each with tests.
3. `packages/ui` in this repository, while the page format, IDs and spread rules still change. It moves to its own repository after 1.0 if its release pace differs from the compiler's. The parts follow the [roadmap](#roadmap).
4. `examples/ui`, a page of every part, covered by `pnpm e2e` with an accessibility check such as axe-core.
5. Docs in `website/docs/ui`, with live samples.

Cost: about 2 weeks for the compiler work, then the phases of the roadmap below.

#### Roadmap

The parts come from `react-aria-components` 1.22.1 (2026-10-09). Each phase ships when its parts have tests that follow React Aria's behaviour, an accessibility check, docs and live samples. A phase builds on the ones before it.

| Phase                      | Parts                                                                                                                                                                                                                                                                                                | Needs                                                                                              | Cost                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 0. Foundations             | Press, focus and hover handling (`Pressable`, `Focusable`), `VisuallyHidden`, `Keyboard`, `I18nProvider` (locale and direction), context composition with `slot`, `as`, render props and `data-*` state                                                                                              | The `Select` spike, conditional `preventDefault`, handlers in spreads                              | 3 to 4 weeks, with the compiler work |
| 1. Controls and fields     | `Button`, `ToggleButton`, `ToggleButtonGroup`, `Link`, `Label`, `Text`, `Input`, `TextArea`, `TextField`, `SearchField`, `Checkbox`, `CheckboxGroup`, `RadioGroup`, `Switch`, `FieldError`, `Form`, `Group`, `Separator`, `Heading`, `Toolbar`, `Breadcrumbs`, `Meter`, `ProgressBar`, `FileTrigger` | Phase 0. `Form` and `FieldError` use [progressive forms](#progressive-forms).                      | 3 to 4 weeks                         |
| 2. Disclosure and overlays | `Disclosure`, `DisclosureGroup`, `Popover`, `OverlayArrow`, `Dialog`, `Modal`, `Sheet`, `Tooltip`, `PreviewTrigger`, `Toast`, and `Transition` from Terracotta                                                                                                                                       | Phase 1. `<dialog>`, the Popover API, `commandfor` and CSS anchor positioning do most of the work. | 4 to 5 weeks                         |
| 3. Collections             | The collection model (keys, sections with `Header`, disabled keys, single and multiple selection, typeahead, focus within a list), `ListBox`, `Menu` with submenus, `Select`, `ComboBox`, `Autocomplete`, `Tabs`, `TagGroup`, `GridList`, `SelectionIndicator`                                       | Phase 2 for the popovers of menus and selects                                                      | 6 to 8 weeks                         |
| 4. Numbers                 | `NumberField`, `Slider` with several thumbs                                                                                                                                                                                                                                                          | Phase 1, and `@internationalized/number`                                                           | 2 weeks                              |
| 5. Dates and times         | `Calendar`, `RangeCalendar`, `DateField`, `TimeField`, `DatePicker`, `DateRangePicker`                                                                                                                                                                                                               | Phases 2 and 3, and `@internationalized/date`                                                      | 4 to 6 weeks                         |
| 6. Data                    | `Table` with sorting, selection and column resizing, `Tree`, `NavigationTree`, `TokenField`, `Virtualizer`, drag and drop with `DropZone`, and list and tree data helpers                                                                                                                            | Phase 3                                                                                            | 6 to 8 weeks                         |
| 7. Color                   | `ColorPicker`, `ColorArea`, `ColorSlider`, `ColorWheel`, `ColorThumb`, `ColorField`, `ColorSwatch`, `ColorSwatchPicker`                                                                                                                                                                              | Phases 1 and 4                                                                                     | 3 to 4 weeks                         |

Notes for each phase:

- Phase 0 is most of the risk. It settles how a part merges its context with its props, how state reaches the caller's markup, and how `as` passes handlers and focus to a component. Every later part depends on it.
- Phase 1 parts are mostly markup and attributes, and many need no client code until they are used. A `Checkbox` is a native `<input type="checkbox">` with labels and states.
- Phase 2 uses the platform where it can. `Modal` and `Sheet` are `<dialog>` with `showModal()`. `Popover` and `Tooltip` use the Popover API and anchor positioning, so they need no positioning code. A click outside closes them through `popover="auto"`, or a listener that is added when they open.
- Phase 2 animates in two ways:
  - Overlays animate as they open and close with CSS alone. `<dialog>` and popovers are hidden, not removed, so `@starting-style` and `transition-behavior: allow-discrete` on `display` and `overlay` cover both directions.
  - `Transition` animates content that is removed, such as an `#if` body or a toast, which CSS cannot do because the node is gone. It follows [Terracotta](https://github.com/lxsmnsyc/terracotta)'s `Transition`: it keeps the content until its leave transition ends, then removes it. It takes Terracotta's `enter`, `enterFrom`, `enterTo`, `leave`, `leaveFrom` and `leaveTo` class props, and sets `data-closed`, `data-enter` and `data-leave` for CSS without class lists, as Headless UI does. It needs no compiler or runtime change: a signal of its own keeps the content mounted, and an `#if` removes it after `transitionend` or `animationend`, with a timeout when neither fires. The server renders the content as `show` says, with no animation on load. `prefers-reduced-motion` skips the wait. Nested `TransitionChild` coordination, and leave animations for `#for` items, which need a hook in the list code of the runtime, come later.
- Phase 3 is the largest. Collections take `items` and an item `#template`, because brumate cannot read the structure of markup the way React Aria reads its children. Keyboard movement and typeahead go in a `.brm.ts` module that every collection shares. `Select` and `ComboBox` keep a native `<select>` or `<input>` where they can, so forms post without scripts.
- Phase 4 parses and formats numbers by locale on the server and in the browser with the same code.
- Phase 5 keeps dates in signals as ISO strings, because the page state cannot hold `CalendarDate` class instances.
- Phase 6 renders rows on the server. `Virtualizer` and drag and drop run only in the browser, from `$client` and handlers, so they load when used.
- Phase 7 is the least common need, so it comes last.

Not ported:

- `SharedElementTransition`, because view transitions cover it.
- `CollectionBuilder` and the other internals, because brumate builds collections from `items` and templates.
- `RouterProvider`, because brumate's links already navigate on the client.

Order of value: phases 0 to 3 cover most of what apps use, in about 4 to 5 months. Phases 4 to 7 can follow what users ask for.

Not planned: running React Aria, Radix or Headless UI, which need React; an adapter for Zag.js state machines, whose state does not resume and which costs 14 to 27 kB gzip per widget; and wrappers for TanStack Query or TanStack Form, which overlap with `$memo`, `refresh`, `$action` and `parseForm`.

### Progressive forms

A form library for brumate, `brumate/forms`. Its server side and wire format follow [Conform](https://conform.guide), which builds forms that work without scripts in Remix and Next.js. Its component API follows [Formisch](https://formisch.dev), which types field paths from the schema and keeps form state in signals. It is written in brumate. No React code runs.

brumate forms already post without scripts, with `action=fn`, `parseForm` and `$action`. This adds lists, echoed values, form-level errors, accessibility attributes and validation in the browser on top.

#### Libraries compared

| Library       | Model                                                        | Without scripts | Lists                                              | Fit                                                         |
| ------------- | ------------------------------------------------------------ | --------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| Conform       | Server first, built on `FormData`                            | Yes, by design  | Path names and intent buttons                      | The protocol to copy. Its API is made for React.            |
| Superforms    | Server first, on SvelteKit form actions                      | Yes             | Yes. Its JSON mode for complex data needs scripts. | Close in spirit, tied to SvelteKit.                         |
| Formisch      | Client first, one small core for many frameworks, on signals | No              | Typed paths from the schema                        | The API to copy. It has no story for forms without scripts. |
| TanStack Form | Client first, with a store, and server validation in Start   | Not built in    | Yes                                                | Heavy, and its store does not resume.                       |

So `brumate/forms` takes the wire format from Conform and the shape of the API from Formisch. Validation uses Standard Schema, as `parse` and `parseForm` do.

#### Wire format

- Field names are paths: `email`, `address.city`, `items[0].name`. `parseForm` learns bracket indexes too, so `items[0].name` makes an array. Its current rules for `a.b`, repeated names and `tags[]` stay.
- An intent is a submit button with a reserved name. A button posts its value only when it is clicked, so intents work without scripts:

  ```html
  <button name="__intent" value='{"type":"remove","name":"items","index":1}' formnovalidate>Remove</button>
  ```

  The types are `insert`, `remove`, `reorder`, `reset` and `validate`.

- The reply is data, so it goes through `$action` and the page state:

  ```ts
  type SubmissionResult = {
    status: 'success' | 'error' | 'intent';
    // The values as posted, after the intent. Files and passwords are left out.
    value: unknown;
    // The errors of each field, by path name.
    errors: Record<string, string[]>;
    // The errors of the whole form. They replace errors[''] of fieldErrors.
    formErrors: string[];
    // Stable keys of list items, for `#for … by`.
    keys: Record<string, string[]>;
  };
  ```

#### Server

```ts
import { parseSubmission } from 'brumate/forms';

async function save(data: FormData) {
  'use server';
  const submission = await parseSubmission(data, Order);
  if (submission.status !== 'success') {
    // An intent, or values that failed the schema: send the values back.
    return submission.reply();
  }
  if (await db.orders.exists(submission.value.id)) {
    return submission.reply({ formErrors: ['That order exists already'] });
  }
  await db.orders.save(submission.value);
  return submission.reply({ reset: true });
}
```

- An intent changes the posted values. It inserts, removes or moves a list item and keeps the keys of the others. It reports no errors on fields that were not touched.
- An intent is input from the browser, so it is checked: its path must exist in the posted values, indexes must be in range, lists have a maximum length, and path parts such as `__proto__` are rejected, as in `parseForm`.

#### Component

`form(schema, result, options)` is a function of a `.brm.ts` module that ships with brumate. Its state is signals, so it resumes like any reactive module.

```html
<script>
  import { $action } from 'brumate/signals';
  import { form as createForm } from 'brumate/forms';

  const result = $action(save);
  const form = createForm(Order, result, { defaultValue: { items: [{ name: '' }] } });
  const items = form.list(['items']);
</script>

<form action=save {...form.attrs} onFocusout=form.blur onInput=form.input onClick=form.intent>
  <button {...form.defaultSubmit}></button>

  <label for=(form.field(['email']).id)>Email</label>
  <input {...form.field(['email']).attrs} type="email" required>
  #if (form.field(['email']).errors) {
    <p {...form.field(['email']).errorAttrs}>{form.field(['email']).errors[0]}</p>
  }

  #for (item of items.items by item.key) {
    <input {...form.field(['items', item.index, 'name']).attrs}>
    <button {...items.remove(item.index)}>Remove</button>
  }
  <button {...items.insert()}>Add an item</button>

  #if (form.errors) {
    <p role="alert">{form.errors[0]}</p>
  }
  <button>Save</button>
</form>
```

- `form.field(path)` takes a path as an array, typed by the output of the schema. A string such as `'items[0].name'` also works. It returns:
  - `attrs`: `name`, `id`, `aria-invalid`, `aria-describedby`, and the echoed `value`, `checked` or `selected`.
  - `errors`, `errorAttrs` (the id of the error, and `role="alert"` after a submit), and the typed default value.
- `form.list(path)` returns the items with their keys and indexes, and `insert()`, `remove(index)` and `reorder(from, to)`, which give the attributes of intent buttons.
- `form.fieldset(path)` gives the same helpers below a path, for a part of the form in its own component.
- `form.errors` holds the errors of the whole form.
- `form.defaultSubmit` is a hidden submit button. Enter in a field submits the first submit button of the form, so without it, Enter could press "Remove".
- Every helper gives plain attributes. No field or button has a handler, so spreads work as they do today.

#### Without scripts

The same markup works in three states:

1. Without scripts, the form posts and the page renders again with the result. The fields show what was typed and their errors. An intent button posts the whole form, and the server applies the intent, so what was typed in other fields stays.
2. With scripts, before the code of the form loads, `$action` sends the form with `fetch`, and the page does not load again.
3. With the code of the form loaded, it validates as fields change and applies intents at once.

What a form without scripts has to handle:

- The constraint attributes of the browser, such as `required` and `type="email"`, still block a submit. Intent buttons have `formnovalidate`, so a list can grow while the form is incomplete.
- A checkbox that is not checked is not posted. The schema must read a missing value as `false`.
- A file input cannot be filled again. After an error, the user picks the file again, and only the error shows.
- Passwords are not echoed.
- Each post loads the page, so focus and scroll start over. A summary of errors should link to its fields, such as `<a href="#email">`.

#### In the browser

- `onFocusout=form.blur` and `onInput=form.input` on the `<form>` see every field, because brumate delegates events. They validate with the same schema and show the errors of fields that were touched, and of every field after a submit, as Conform does.
- `onClick=form.intent` handles clicks on intent buttons. It applies the intent to the values at once and stops the post.
- The schema and the validation code load with the first focus out or input, not with the page, so a form costs nothing until someone uses it.
- `form.intent` must stop the click before it submits the form. Handlers run after their code loads, so this needs `:prevent` on the button, or one of the conditional `preventDefault` options in [Headless UI components](#headless-ui-components). Until then, an intent goes to the server through `$action`, which works, but slower.

#### Plan

1. The wire format and the server: `parseSubmission`, bracket paths in `parseForm`, `reply`, and the field and list helpers with plain attributes. It works without scripts and through `$action`. About 1 week with tests and docs.
2. Validation in the browser through `onFocusout` and `onInput` on the form, loaded when first used. About 3 to 4 days.
3. Intents in the browser, once the click can be stopped. About 2 to 3 days.

It lives at `brumate/forms` while the page format still changes, and can move to its own package later.

### Markdown with components

Markdown pages that can use brumate components and expressions, as mdsvex does for Svelte and MDX does for React. Content sites are mostly static, which is where resuming pays off most: a docs page ships no code unless a component on it has handlers.

- A `.md` page compiles to a `.brm` component. Front matter becomes its props or page metadata. Fenced code is highlighted at build time.
- The website already has a markdown plugin and live samples. They would become a general plugin that apps can use.

Cost: about 1 to 2 weeks, most of it for the parser integration, source maps and editor support.

### Compiled messages for i18n

[Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) compiles each translated message to its own function, so a page ships only the messages it uses. That matches how brumate ships only the code an event needs.

- Paraglide works with any framework, so this is a guide and a small adapter, not a port: the locale of a request on the server, the same locale on the client, and links that keep it.
- Messages that the server renders cost no client code. Only messages in client code, such as a handler that shows a toast, ship.

Cost: a few days for the adapter, a guide and an example.

### Order

1. Blocking async memos. They fix `await` in components that the browser renders, and they make the state of more pages one record.
2. Progressive forms, steps 1 and 2. They need no compiler work, because their helpers give plain attributes and their handlers sit on the `<form>`. Every app has forms.
3. Errors in client code, so a handler that throws shows a `#catch` body instead of failing silently. Forms and the UI components run most of their code in handlers.
4. Routing in the browser. It is small, and filters and tabs in the URL are common.
5. Element behaviors, testing routes, budgets for one event and rate limiting. Each is small, and rate limiting protects the server functions that every app has.
6. Transitions, which the UI components need in phase 2.
7. Conditional `preventDefault` and handlers in spreads. Intents in the browser need the first. The UI components need both. Components from packages are done.
8. Progressive forms, step 3, and the UI components, starting with the `Select` spike.
9. Caching pages and data, now that `#defer` can render the parts of a cached page for each user.
10. Compiled messages, Markdown with components, two-way realtime, embedding, worker functions, offline pages, long lists and the rest when an app or the website needs them.
