# Proposals

Features that would be good to add, with the reason for each, a sketch, and a rough cost. None of them is decided. [Decisions](./decisions.md) lists what is.

## Summary

| Proposal                                                              | Area    | Value  | Cost   |
| --------------------------------------------------------------------- | ------- | ------ | ------ |
| [Two-way binding](#two-way-binding)                                   | Syntax  | High   | Medium |
| [Serialization entry](#serialization-entry)                           | Data    | High   | Medium |
| [Prerendering with holes](#prerendering-with-holes)                   | Server  | High   | Medium |
| [Caching pages and data](#caching-pages-and-data)                     | Server  | High   | Medium |
| [Middleware entry](#middleware-entry)                                 | Server  | High   | Small  |
| [Request locals](#request-locals)                                     | Server  | Medium | Small  |
| [Idempotent calls](#idempotent-calls)                                 | Server  | Medium | Small  |
| [Two-way realtime](#two-way-realtime)                                 | Server  | Medium | Medium |
| [Embedding in other sites](#embedding-in-other-sites)                 | Build   | Medium | Medium |
| [Transitions](#transitions)                                           | Syntax  | High   | Medium |
| [Long lists](#long-lists)                                             | Syntax  | Medium | Medium |
| [Streaming lists](#streaming-lists)                                   | Syntax  | Medium | Medium |
| [Reveal order](#reveal-order)                                         | Syntax  | Medium | Small  |
| [Devtools](#devtools)                                                 | Tooling | High   | Medium |
| [Component workbench](#component-workbench)                           | Tooling | Medium | Medium |
| [Worker functions](#worker-functions)                                 | Runtime | Medium | Medium |
| [Offline pages](#offline-pages)                                       | Runtime | Medium | Medium |
| [Observability](#observability)                                       | Runtime | Medium | Medium |
| [Content mappers for TypeScript 7](#content-mappers-for-typescript-7) | Tooling | High   | Medium |
| [Headless UI components](#headless-ui-components)                     | Library | High   | Large  |
| [Progressive forms](#progressive-forms)                               | Library | High   | Medium |
| [Markdown with components](#markdown-with-components)                 | Library | Medium | Medium |

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

#### Bindable props

A component such as a dialog, a tab list or a select has state that its parent sometimes wants to own, and sometimes not. Svelte 4 said so with `export let`, a prop that the child can write. Svelte 5 kept the idea inside its props, with `$bindable`, which fits `$props` here too:

```html
<!-- Dialog.brm -->
<script>
  import { $bindable, $props } from 'brumate/signals';

  let { open = $bindable(false), title } = $props<{ open?: boolean; title: string }>();
</script>

<button onClick=(() => (open = !open))>{title}</button>
#if (open) {
  <div role="dialog">…</div>
}
```

```html
<!-- A parent that owns the state, and one that does not. -->
<Dialog title="Settings" bind:open=settingsOpen />
<Dialog title="Help" />
```

- `let { name = $bindable(initial) } = $props()` declares a prop that the component can write. Other props stay `const`, so a write to them is a compile error, as now.
- With `bind:name=signal`, the parent owns the value: a write in the child writes the parent's signal, and the parent's change reaches the child as any prop does. The target must be a signal of the parent.
- With a plain `name=value`, or no attribute, the child owns it: a write changes the child's copy. A new value from the parent replaces the copy, as `$optimistic` gives up its guess when its source changes.
- `initial` is the value when the parent passes nothing.
- On the server, nothing writes, so a bindable prop is its value. A bound child keeps its parent's scope and slot in the page state, so its writes in the browser go up without a request.
- The type checker types `bind:name` as the prop's type, and reports it on a prop that is not bindable.

`export let` would mean two ways to declare props. `$bindable` keeps one: `$props()`, with a marker on the props that the component writes.

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

### Streaming lists

A memo of a stream takes each value as it arrives, so a list that grows, such as the reply of a language model, search results or log lines, has to gather its items by hand.

```html
<script>
  import { $props } from 'brumate/signals';
  import { reply } from './chat.server';

  const { prompt } = $props<{ prompt: string }>();
</script>

<ol>
  #for await (token of reply(prompt)) {
    <li>{token}</li>
  } #else {
    <li>Thinking…</li>
  }
</ol>
```

- `#for await (item of stream)` renders an item for each value of an async iterable, such as a server function that yields, as it arrives. `#else` shows until the first one.
- On the server, the items stream into the page in the order they come, as `#loading` bodies do, and the page does not wait for the stream to end.
- In the browser, the core appends the items that arrive after the page, from the render module, and the list keeps them as signals of its own. When the expression gives a new stream, such as for a new prompt, the list starts again.
- `by key` keeps items when a stream sends a value with a key that it sent before, so a stream can update an item in place.
- The memo of the stream keeps its last value, as now, for code that only needs the latest.

Cost: about 1 to 2 weeks. Memos already read streams, and lists already add items in the browser.

### Reveal order

`#loading` bodies show as their data arrives, in any order, so a page with several of them can jump around while it streams. React's `SuspenseList` and Solid 2.0's `<Reveal>` let siblings show in an order, or together. In brumate, a body only goes from its fallback to its content once, while the page streams: a memo that loads again in the browser keeps its last value. So the order is about the stream, which the server controls.

```html
#reveal ('sequential', collapsed) {
  #loading { <Profile /> } #else { <p>Loading the profile…</p> }
  #loading { <Posts /> } #else { <p>Loading the posts…</p> }
  #loading { <Friends /> } #else { <p>Loading the friends…</p> }
}
```

- `'sequential'`, the default, shows the bodies in the order of the markup. When a body is ready, the server holds what it sends for it, the `<template b-l>`, the swap and its state record, until every body before it is sent. The data still loads at the same time. Only the showing waits.
- `'backwards'` does the same from the last body to the first, as React's `revealOrder="backwards"`.
- `'together'` holds every body of the group until the last one is ready, and sends them at once.
- `'natural'` shows each body when it is ready, as now.
- `collapsed`, with an order, shows only the fallback of the next body to show. The server renders the other fallbacks in `<template b-f="id">`, and the chunk that shows a body also moves the next fallback in, with a small `$bF(id)` script like `$bS`. It needs no core and no client code.
- The names follow Solid 2.0, with `'backwards'` from React.

How it fits:

- Each body renders in its own ID space, such as `5.0`, so holding one back changes no other ID.
- A `#reveal` inside a `#loading` body orders the bodies of that body, as nested lists do in React.
- Rendering in order, for readers without scripts, puts bodies in the order of the page, which keeps `'sequential'` and `'together'` by itself.
- Pages that client navigation loads stream through the same path, so they keep the order.
- `#defer` blocks in a `#reveal` can follow the same order in the browser: the module that loads them waits to put a body in until the ones before it are in.
- Without `#reveal`, nothing changes.

Prior art: React's `SuspenseList`, with `revealOrder` and `tail`, and Solid 2.0's `<Reveal>`, with `order` and `collapsed`. Solid 2.0 is in beta, so its details can still change.

Cost: about 1 week, most of it in the server's handling of boundaries and the `$bF` script. The compiler only adds the block, and gives each boundary its group, its place and the order.

## Data

### Serialization entry

The page state and server function calls hold the values that seroval and brumate's plugins can write. A class of the app, such as `Money`, a `Decimal` or a Temporal value, has to be sent as a plain object and made again by hand, and the serializer options are fixed.

```ts
// src/serial.ts
import { definePlugin } from 'brumate/serial';
import { Money } from './money';

export const plugins = [
  definePlugin({
    tag: 'app/money',
    test: (value) => value instanceof Money,
    toData: (money: Money) => [money.amount, money.currency],
    fromData: ([amount, currency]) => new Money(amount, currency),
  }),
];
```

- An entry file, `src/serial.ts` by default and set with the `serial` option of the plugin, as SolidStart reads its own entries, exports `plugins` and the options that it changes.
- `definePlugin` makes a seroval plugin from `toData` and `fromData`. In the page state, a value is written as `$b.u('app/money', data)`, so the record does not need the class in scope.
- The browser makes the value with `fromData` when the core reads the record. The entry loads with the core, not with the loader, so a page that is never used does not load the class.
- `disabledFeatures` and `depthLimit` can change. Turning on a feature that brumate turns off, such as `RegExp`, warns, because brumate turns it off on purpose.
- The type checker accepts a value of a class with a plugin in the state.
- The same plugins write server function calls and their answers, and the stubs of two-way realtime.

Cost: about 1 week, most of it for loading the entry with the core and for the types.

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

## Routing

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
- The cache is an interface, with an in-memory store as the default. With Nitro, it uses Nitro's storage layer, unstorage, whose drivers cover Redis, Cloudflare KV and the stores of other hosts.
- Prerendered pages are the case with no expiry. `maxAge` and `revalidate` extend them to pages that change.

Cost: about 2 weeks. Most of it is the rules for what is safe to share between users, and the tests for them.

### Prerendering with holes

A prerendered page is the same for everyone, so a `#defer` body asks for its part in a request of its own, one round trip per block. React 19.2 prerenders a shell, keeps what it postponed, and renders only the holes for each request, in the same response.

- A prerendered page keeps its `#defer` blocks as holes. The build writes the HTML of the shell, and the boundary of each hole.
- For a request, the server sends the shell from the file or a cache at once, then renders every hole in defer mode and streams each body as a ready `#loading` body, in the same response.
- The render of the holes is the one that `#defer` requests make: the route again, with the bodies around each target, and no other body. One render can give all the holes of a page.
- Without a server, on a static host, the shell is the whole answer, and each hole asks for its body when its trigger fires, as now.
- It combines with caching: the shell is cached for everyone, and the holes are rendered for one user.

Cost: about 1 week, after `#defer`. Most of it is rendering several targets in one request.

### Middleware entry

`_middleware.ts` runs before the routes of its folder, pages and endpoints. Server function calls, at `/_brumate/<id>`, go past it, so each server function checks the user itself, and a function that forgets is open.

```ts
// src/middleware.ts
import { defineMiddleware, redirect } from 'brumate/server';

export default defineMiddleware(async (event, next) => {
  event.locals.user = await readUser(event);
  if (event.kind === 'call' && event.call.id.startsWith('admin') && !event.locals.user?.admin) {
    return new Response('Forbidden', { status: 403 });
  }
  return next();
});
```

- An entry file, `src/middleware.ts` by default and set with the `middleware` option of the plugin, runs for every request: pages, endpoints, server function calls, form posts, `#defer` bodies and `?__action` posts.
- `event.kind` says which one it is: `'page'`, `'endpoint'`, `'call'` or `'defer'`. For a call, `event.call` has the ID of the function and its arguments, after they are read, so a check can depend on them.
- It runs first, before the `_middleware.ts` of the folders. Those stay for what belongs to one part of the site.
- A `'use server'` file can export `middleware` too, which runs before each of its functions only, for a group of functions with the same rule.
- Cross-site calls are refused before any middleware runs, as now.

Cost: a few days. The routes already run middleware in a chain, and calls get the same chain.

### Request locals

Middleware has no typed way to hand what it finds, such as the user or a client of the database, to the components and server functions of the request.

```ts
// src/locals.d.ts
declare module 'brumate/server' {
  interface Locals {
    user?: { id: string; name: string; admin: boolean };
  }
}
```

- `event.locals` is an object for the request. Middleware writes it, and components, server functions and endpoints read it with `getEvent().locals`.
- Its type comes from the `Locals` interface, which the app adds to by declaration merging, as SvelteKit's `App.Locals`.
- It never goes to the browser. A component that sends a value from it, such as the user's name, reads the field it needs, as it does with any server value.
- `getEvent().waitUntil(promise)` keeps work going after the response ends, such as analytics or a log line. On a host that stops a function when its response ends, such as Cloudflare Workers or Vercel's functions, it passes the promise to the platform's `waitUntil`, which Nitro exposes. On Node, or on a server of the app's own, it keeps the promise and logs its error. An app that wants `after(fn)` writes it on top in two lines.

Cost: a few days.

### Idempotent calls

A call that runs twice, such as one that the offline queue sends again, one that reconnects, or a form posted twice, makes two orders or two messages.

- `idempotent(fn)` wraps a server function. The browser sends a key with each call, and sends the same key when it sends that call again.
- The server keeps the result of a key for a time, in the store of [caching pages and data](#caching-pages-and-data), and answers a call with a key that it has seen with the result that it kept, without running the function.
- A call with a key that is still running waits for that run.
- Form posts without scripts get a key in a hidden field, so a second post of the same form is the same call.

Cost: a few days, after the store of caching.

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
- The transport is WebSocket, with a fallback to the stream that server functions already use and a `POST` for each call. With Nitro, the WebSocket side uses its crossws support, which runs on Node, Bun, Deno and Cloudflare. A server of the app's own passes the upgrade to a handler that brumate exports.

Prior art: Cap'n Web, from Cloudflare, passes functions by reference as stubs over WebSocket and HTTP. Cap'n Proto calls them capabilities.

Cost: about 3 weeks. The serializer and the call protocol of server functions exist. Most of the work is the stubs on both sides, their release, reconnection, the fallback and the WebSocket handler for Nitro and for a server of the app's own.

## Tooling

### Content mappers for TypeScript 7

TypeScript 7 does not load plugins, so `.brm` files get types only from TypeScript 6 and older, through `@brumate/tsc` and `@brumate/typescript-plugin`. TypeScript 7.1 adds an API for content mappers, which turn the files of other languages into TypeScript and map positions between them.

- A content mapper from `toTypeScript` would let `tsc` and the editor of TypeScript 7 check `.brm` files.
- It would replace `@brumate/tsc`, and the TypeScript plugin in the extension.
- This waits for the API to be stable, and for its documentation.

### Devtools

The panel has four tabs today: the scopes and their values, the graph of a component, a log of handlers, loads, writes and calls, and the report of a component. It shows the browser after the page resumed, and little of what makes a brumate page what it is: what the server sent, why code loaded, and the blocks that render later.

What it should show:

- **Elements.** Pick an element to see its scope, its anchor, its handlers with the size of each one's part and whether it loaded, and the values that its updates read. A link opens the `.brm` file at the line of the element in the editor, from the source maps, through the dev server, as Vite's `launch-editor` does.
- **Loading.** A timeline of every part that loaded, with why: an event, the idle preload, an element that came into view, a hover, or navigation. Each row has its size, its time and the event that waited for it. Preloads that nothing used are marked.
- **Page state.** The bytes of the first state record by component and by slot, and for each slot the client code that reads it, which is why it is sent. A value that is large, or sent but rarely read, stands out.
- **Blocks.** Every `#loading`, `#defer` and `#client` block of the page with its state: fallback, waiting, streaming or rendered, its trigger, and when its body arrived and how long it took. Buttons fire a trigger now, or show a block's fallback again, to test both sides.
- **Effects.** The `$effect`s and `$client` callbacks that are active, how often each ran, and when its cleanup ran last, so an effect that runs too often is easy to find.
- **Server.** For the request of the page: the render time, each memo load and server function call with its time, and each boundary, from the traces of [observability](#observability) in development.
- **Navigation.** For the last client navigation: the layouts that stayed, the routes that were replaced, and the IDs that moved.
- **Errors.** Errors of client code with their scope and component, from `onError` of the loader.
- **History.** The writes of the log can be undone one by one, and a session of writes can be exported and replayed, to share how a bug happens.

How it ships:

- The panel stays in the page in development, so it needs no extension, and loads only when opened.
- A browser extension can show the same panel in the browser's devtools later, so it does not cover the page, and so a production build can open it with an option.

Cost: about 3 to 4 weeks for all of it. Elements, loading and blocks first, about 1 week, since the runtime already reports most of what they need.

### Component workbench

An exploration, not a plan yet. A page in the dev server that lists the components of the app, renders each one on the server with props from controls, and resumes it, as Storybook and Ladle do for other frameworks.

- `brumate preview` finds the `.brm` files of the app and lists them by folder. The type checker knows the props type of each, from `$props<T>()`, so it can make the controls: text, numbers, booleans, choices for unions, and JSON for the rest.
- A story file is optional: `Button.stories.ts` exports named sets of props, and named states with a server function answer or a request, using the helpers of `brumate/testing`.
- Each story renders through `mount`, so what it shows is what the page gets, with the panel of the devtools beside it, and the report of what the component ships.
- The website's live samples already compile, render and resume components in a page, so most of the pieces exist.

Questions to answer first: whether props from controls are enough without story files, how to show components that need a context or a route, and whether it belongs in the dev server or in its own command.

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
- The split between controlled and uncontrolled state, below.

#### Controlled and uncontrolled

Each part that has state comes in two shapes, as in Terracotta, and the prop that the caller passes picks one:

| Uncontrolled     | Controlled | Parts                                                                                           |
| ---------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `defaultOpen`    | `open`     | `Disclosure`, `Dialog`, `Modal`, `Sheet`, `Popover`, `Tooltip`, `Menu`, `Select`, `ComboBox`    |
| `defaultValue`   | `value`    | `Select`, `ComboBox`, `ListBox`, `RadioGroup`, `Tabs`, `Slider`, `NumberField`, the date fields |
| `defaultChecked` | `checked`  | `Checkbox`, `Switch`                                                                            |
| `defaultPressed` | `pressed`  | `ToggleButton`                                                                                  |

```html
<!-- Uncontrolled: the dialog keeps its own state, and onChange only reports it. -->
<Dialog defaultOpen=(false) onChange=((open) => log(open))>…</Dialog>

<!-- Controlled: the dialog never writes. Nothing moves until the parent passes a new value. -->
<Dialog open=settingsOpen onChange=((open) => (settingsOpen = open))>…</Dialog>

<!-- The same, with a bindable prop. -->
<Dialog bind:open=settingsOpen>…</Dialog>
```

- **Uncontrolled**: the part owns a signal that starts at the default, and writes it. `onChange` tells the caller what happened.
- **Controlled**: the part never writes its state. It calls `onChange` with the value it wants, and shows the value that the caller passes. A caller that does not write it back gets a part that does not move, and the docs say so, as Terracotta's do.
- `bind:open=signal` is the controlled shape with an `onChange` that writes the signal, from [bindable props](#bindable-props). The parts declare `open` as bindable, so both spellings work.
- The props type is a union of the two shapes, so passing `open` and `defaultOpen` together is a type error, as Terracotta's types do.
- The shape is chosen once, by which prop is there: `'open' in props`, as Terracotta's `isDisclosureUncontrolled` checks `'defaultOpen' in props`. A part does not switch shape after it renders.
- One helper in the shared `.brm.ts` module gives every part the same rule: `controllable(props, 'open', 'defaultOpen')` returns a value to read and a `set` that writes the part's own signal when it is uncontrolled, and calls `onChange` either way.

What brumate adds to the split:

- The caller's attributes are in its markup, so the compiler usually knows the shape of each use. A part that is only ever used uncontrolled does not need the code that waits for the caller, and the reverse, so the shape can decide what ships.
- The state of an uncontrolled part is a slot of the part's own scope, which the page state sends. A controlled part's state is a slot of the caller, so the part sends nothing of its own.
- On the server, nothing writes, so both shapes render the value that they start with: the default, or the caller's value.

#### How it maps to brumate

| React Aria Components or Terracotta | brumate                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Context provider in `Select`        | `$setContext(POPOVER, { … })` in `Select.brm`                                                                             |
| `useContextProps` in a part         | `$getContext(POPOVER)` merged with the part's props                                                                       |
| `slot` prop                         | A context value keyed by slot, read as `ctx[slot]`                                                                        |
| `triggerRef` for positioning        | CSS anchor positioning: `anchor-name` on the trigger and `position-anchor` on the popover. It needs no ref and no script. |
| Behaviour hooks                     | Functions in a `.brm.ts` module that the parts share                                                                      |
| Children as a render function       | A named `#template` prop, because `children` is markup that the server renders                                            |
| `defaultOpen` and `isOpen`          | `defaultOpen`, and `open` or `bind:open`, through one `controllable` helper                                               |
| Collections from JSX children       | An `items` prop and an item `#template`, because brumate cannot read the structure of markup                              |
| Global listeners at startup         | CSS `:focus-visible` in place of focus-visible tracking. Listeners for a click outside are added when an overlay opens.   |
| `@internationalized/date`, `number` | Used as they are                                                                                                          |

Native features cover parts of the behaviour with no script: `<dialog>` with `showModal()`, the Popover API, `commandfor` and `command` on buttons, and CSS anchor positioning.

#### What the compiler needs first

1. Conditional `preventDefault`. Done as `prevent(handler, 'ArrowDown', 'Enter')` from `brumate/events`, which the loader applies by key. See [Markup](../website/docs/markup.md#before-the-handler-loads).
2. Handlers in spreads. Done for the handlers that a caller passes on, which a spread writes into `b-on` with the scope of their owner and their wrappers. Markup that the browser renders gets the attributes of a spread, and not its handlers yet. See [Components](../website/docs/components.md#handlers-in-a-spread).
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

### Order

Each step lists what it holds and why it comes there. A step can start before the one above it ends, when they touch different code.

1. **Progressive forms, steps 1 and 2.** They need no compiler work, because their helpers give plain attributes and their handlers sit on the `<form>`.
2. **Devtools: elements, loading and blocks.** They show what makes a brumate page different, from data that the runtime already reports. The rest of the devtools comes in step 6.
3. **What the UI components need first**: bindable props and transitions. Handlers in spreads are done, and element behaviors are `$client` with `ref`. Bindable props carry the controlled and uncontrolled split of the parts.
4. **Progressive forms, step 3, and the UI components**, starting with the `Select` spike.
5. **Caching**: caching pages and data, the serialization entry, idempotent calls, and prerendering with holes. Idempotent calls and rate limiting keep their results in the store of caching, and the serialization entry lets cached data hold classes.
6. **Streaming and tools**: reveal order, streaming lists, the rest of the devtools, and the component workbench, which is an exploration first.
7. **When an app or the website needs them**: Markdown with components, two-way realtime, worker functions, offline pages, embedding, long lists, observability. Timing helpers are done, and persisted signals are a cookie and an effect.

Content mappers for TypeScript 7 are done in #3, so they are in no step.
