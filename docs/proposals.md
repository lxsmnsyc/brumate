# Proposals

Features that would be good to add, with the reason for each, a sketch, and a rough cost. None of them is decided. [Decisions](./decisions.md) lists what is.

## Summary

Middleware entry, request locals and timing helpers shipped in 0.2.0. These shipped after it, so they are no longer here:

- Handlers from scripts (`$handler`) and progressive forms (`brumate/forms`).
- Two-way binding (`$bind`) and view transitions of handlers (`transition`).
- Caching (`cache`, `cached` and `revalidate`), the serial entry (`src/serial.ts`), forms that run once (`idempotent`), and prerendered pages with their `#defer` bodies in one response (`shell`).
- The reveal order of `#loading` bodies (`#reveal`), and lists that grow from a stream (`gather`).

| Proposal                                                              | Area    | Value  | Cost   |
| --------------------------------------------------------------------- | ------- | ------ | ------ |
| [Idempotent calls](#idempotent-calls)                                 | Server  | Low    | Small  |
| [Two-way realtime](#two-way-realtime)                                 | Server  | Medium | Medium |
| [Embedding in other sites](#embedding-in-other-sites)                 | Build   | Medium | Medium |
| [Named view transitions](#named-view-transitions)                     | Syntax  | Low    | Small  |
| [Long lists](#long-lists)                                             | Syntax  | Medium | Medium |
| [Streaming lists](#streaming-lists)                                   | Syntax  | Low    | Medium |
| [Reveal order of `#defer` blocks](#reveal-order-of-defer-blocks)      | Syntax  | Low    | Small  |
| [Devtools](#devtools)                                                 | Tooling | High   | Medium |
| [Component workbench](#component-workbench)                           | Tooling | Medium | Medium |
| [Worker functions](#worker-functions)                                 | Runtime | Medium | Medium |
| [Offline pages](#offline-pages)                                       | Runtime | Medium | Medium |
| [Observability](#observability)                                       | Runtime | Medium | Medium |
| [Content mappers for TypeScript 7](#content-mappers-for-typescript-7) | Tooling | High   | Medium |
| [Headless UI components](#headless-ui-components)                     | Library | High   | Large  |
| [Markdown with components](#markdown-with-components)                 | Library | Medium | Medium |

## Syntax

### Named view transitions

`transition` of `brumate/events` runs a handler inside a view transition. An element animates on its own only when it has a `view-transition-name`, which the author writes by hand and keeps unique, such as ``style=(`view-transition-name: todo-${todo.id}`)`` in a `#for`. Every named element then takes part in every view transition of the page, including navigations.

```html
#for (todo of todos by todo.id) {
  <li viewTransition="todo">{todo.title}</li>
}
#if (open) {
  <div class="panel" viewTransition="panel">…</div>
}
```

```css
::view-transition-group(.todo) { animation-duration: 200ms; }
::view-transition-new(.todo):only-child { animation: fade-in 150ms; }
::view-transition-old(.todo):only-child { animation: fade-out 150ms; }
```

- `viewTransition="todo"` marks an element. It renders as an attribute, and the element gets `view-transition-class: todo`.
- The core names a marked element only while a transition of brumate runs: before the browser captures the old page, and again after the updates for the elements that they added. It removes the names when the transition finishes.
- The name comes from the element itself, such as `todo-7`, not from the key of `by`. A key can be any value, such as an object, and two keys such as `1` and `'1'` would give one name. Keyed lists keep the element of an item, so an element that moves keeps its name and slides. A new element fades in, and a removed one fades out.
- `viewTransitionName=(expression)` gives a name of the author, which pairs two different elements, such as a picture on a list page and on its detail page. A navigation needs it, because the new page has new elements. Elements of layouts that stay keep their names.
- Only marked elements near the viewport get a name, because each named element is a capture of its own. An element that comes from far off screen fades in instead of sliding.
- In development, two rendered elements with the same name of the author are an error in the Errors tab, since the browser skips such a transition without one.
- A name that the CSS of the author gives an element stays.

Limits:

- A named element inside another one animates in a flat group, so the order of painting can be wrong while it runs, until browsers support `view-transition-group: contain`.
- The writes of a handler after its first `await` change the page without an animation, as with `transition` now.

Test first that the names reach elements that an update inserted after its code loaded, and how fast a list of 200 items reorders in Chrome and Safari.

Build it when an app animates lists or shared elements. The manual names work until then, and the UI components animate overlays with CSS and `Transition`.

Cost: about 2 to 3 days. The compiler only renders the attribute.

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

`gather` from `brumate/stream` gives the list of the values of a stream so far, which a memo renders with `#for` as it grows in the browser. The server renders the empty list, because it reads only the first value of a memo.

- `#for await (item of stream) { … } #else { … }` would be the same without the memo, and the server would stream the items of a stream that starts with the page, as `#loading` bodies stream, with the browser reading on from there.

Cost: about 1 to 2 weeks for the server part, when a page needs a stream that starts with it. Handing the stream from the server to the browser without reading it twice is most of it.

### Reveal order of `#defer` blocks

`#reveal` orders the `#loading` bodies that stream from the server. `#defer` blocks inside it show when each body arrives.

- The module that loads `#defer` bodies would wait to put a body in until the ones before it are in, in the order of the `#reveal` around them.

Cost: a day or two, when a page needs it.

## Data

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

### Idempotent calls

`idempotent(fn)` makes forms that run once for each render: a second post of the same form gets the first result. Calls from the browser, such as from a handler, have no key yet, because nothing sends a call again.

- When the offline queue or a reconnect sends calls again, the browser sends a key with each call, and the same key when it sends that call again. The server already keeps the result of a key.

Cost: a day, with the first feature that sends calls again.

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

Elements, loading, blocks with their fallbacks, errors, page state, effects, navigation and server are done, with a timeline and outlines of the elements that change: see [Devtools](../website/docs/inspect.md#devtools). History and a browser extension are left, about 2 weeks.

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

#### Decisions

Settled on 2026-10-24:

- **Browser support.** A part uses a feature of the platform only when at least 95% of global usage supports it. The share is the global usage of each browser version, from caniuse, summed over the versions that MDN's compatibility data marks as supporting the feature. The client of brumate will be checked against the same rule.
- **No native popover or dialog.** Overlays follow React Aria and Terracotta, which use neither: they render with `#portal`, and the shared modules place them, keep focus in them and give it back, close them on Escape or a click outside, and hide the rest of the page from assistive technology.
- **React Aria and Terracotta are the reference.** Where a part has a choice of how to behave, it does what they do, and their tests and docs are the specification.
- **Nested layers.** An overlay mounts in the layer of the nearest floating part above it, such as the `Dialog` or `Popover` that it opens from, and not at the end of `<body>`. React Aria and Terracotta mount every overlay at the end of `<body>`, so this is where the parts differ from them.
- **Unstyled.** The parts render markup, ARIA attributes and `data-*` state, and no CSS. The website shows them styled in its own style, as an example.
- **Docs of their own.** The docs of `@brumate/ui` are on the website, at `/ui`, apart from the docs of brumate. The section has its own navigation, sidebar and search, and shows only the parts. It links to the docs of brumate for the features that the parts use, and the docs of brumate link to it once.
- **Bindable state.** A part has one prop for each state, such as `open`, `value` and `checked`, and no `defaultOpen`. A value starts the part's own copy, and `open=$bind(settingsOpen)` controls it. See [Controlled and uncontrolled](#controlled-and-uncontrolled).

#### Layers

Each floating part renders a layer: an element that the part owns, and that holds the panel that the caller styles. An overlay that opens from inside a floating part mounts at the end of that part's layer, so the layers form a tree that follows the nesting of the parts.

- The overlay paints above its parent, because it comes last in the parent's layer, and the parent is above the page. Only the root layer needs a `z-index`.
- The page sees the nesting. A click in a popover of a dialog is a click inside the dialog, focus that stays in the dialog can go to its popovers, the `aria-hidden` that hides the page behind the dialog does not hide them, and closing the dialog removes them. CSS custom properties of the dialog reach them too.
- The server renders an overlay in its place, after its parent's panel, so the browser moves nothing when the page resumes.

Rules:

1. An overlay mounts in its parent's layer, not in the panel. The layer has no `overflow`, `transform` or `contain`, so a panel that scrolls or animates with a transform does not clip its overlays or change where they are placed.
2. Overlays are placed with `top` and `left`, never with `transform`, so a layer is never the containing block of the overlays in it.
3. An overlay that is not inside a floating part mounts in the root layer, at the end of `<body>`. Toasts always do.
4. A `container` prop overrides this: an element, a selector, or `false` to render in place.
5. Overlays of the same layer stack in the order that they opened.

A `LAYER` context holds the layer of each floating part, and its default is the root layer, so an overlay finds its layer with `$getContext(LAYER)`.

What the 95% rule allows, measured on 2026-10-24:

| Feature                               | Global support | Use                                                                 |
| ------------------------------------- | -------------: | ------------------------------------------------------------------- |
| `inert`                               |          96.4% | Yes, for the page behind a modal                                    |
| `:focus-visible`                      |          96.5% | Yes, in place of focus-visible tracking                             |
| `Element.checkVisibility()`           |          95.2% | Yes, for focus order                                                |
| Popover API                           |          93.6% | No                                                                  |
| `@starting-style`                     |          93.0% | No. Overlays animate with `Transition`.                             |
| `transition-behavior: allow-discrete` |          91.0% | No                                                                  |
| CSS anchor positioning                |          87.3% | No. A shared module places overlays.                                |
| `commandfor` and `command`            |          86.2% | No                                                                  |
| View transitions                      |          92.9% | Only where a browser without them still works, as `transition` does |

#### Controlled and uncontrolled

A part with state has one prop for it, such as `open`, and the way the caller passes it picks the shape. There is no `defaultOpen`. This is where the parts differ from React Aria and Terracotta, which have both props.

| Prop      | Parts                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------- |
| `open`    | `Disclosure`, `Dialog`, `Modal`, `Sheet`, `Popover`, `Tooltip`, `Menu`, `Select`, `ComboBox`    |
| `value`   | `Select`, `ComboBox`, `ListBox`, `RadioGroup`, `Tabs`, `Slider`, `NumberField`, the date fields |
| `checked` | `Checkbox`, `Switch`                                                                            |
| `pressed` | `ToggleButton`                                                                                  |

```html
<!-- Uncontrolled: the dialog keeps its own state, which starts closed. -->
<Dialog onChange=((open) => log(open))>…</Dialog>

<!-- Uncontrolled, from a value: the dialog starts open and keeps its own copy. -->
<Dialog open=(true)>…</Dialog>

<!-- Controlled: the dialog writes the caller's signal. -->
<Dialog open=$bind(settingsOpen)>…</Dialog>

<!-- Controlled, with a setter: the caller decides, and the dialog shows what it keeps. -->
<Dialog open=$bind(settingsOpen, (next) => { if (!dirty) settingsOpen = next; })>…</Dialog>
```

- **A value**, such as `open=(true)` or `open=settingsOpen`, starts the part's own copy, and the part writes the copy. A new value from the caller replaces it, so the caller can still close the dialog.
- **A binding**, `open=$bind(settingsOpen)`, makes the part write the caller's signal.
- **A binding with a setter** calls the setter in place of the write. It can refuse or change the value, and the part shows what the caller keeps, as a controlled part of React Aria does.
- `onChange` reports each new value in every shape.
- This is how a `let` prop of brumate works, so a part needs no helper for it: `let { open = false } = $props<{ open?: Bindable<boolean> }>()`, and a write of `open` goes where the caller said.
- A value of `null` or `undefined` is a value like any other, such as the `value` of a `Select` with nothing selected.
- `$isPassed(open)` and `$isBound(open)` tell a part how the caller passed the prop, for a part that needs to know.

What brumate adds to the split:

- The state of an uncontrolled part is a slot of the part's own scope, which the page state sends. A bound part's state is a slot of the caller, so the part sends nothing of its own.
- On the server, nothing writes, so every shape renders the value that it starts with.

#### How it maps to brumate

| React Aria Components or Terracotta | brumate                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Context provider in `Select`        | `$setContext(POPOVER, { … })` in `Select.brm`                                                                                         |
| `useContextProps` in a part         | `$getContext(POPOVER)` merged with the part's props                                                                                   |
| `slot` prop                         | A context value keyed by slot, read as `ctx[slot]`                                                                                    |
| `triggerRef` for positioning        | A function of a shared `.brm.ts` module that places the overlay next to its trigger, when it opens and as the page scrolls or resizes |
| Behaviour hooks                     | Functions in a `.brm.ts` module that the parts share                                                                                  |
| Children as a render function       | A named `#template` prop, because `children` is markup that the server renders                                                        |
| `defaultOpen` and `isOpen`          | `open`, as a value or `open=$bind(…)`                                                                                                 |
| Collections from JSX children       | An `items` prop and an item `#template`, because brumate cannot read the structure of markup                                          |
| Global listeners at startup         | CSS `:focus-visible` in place of focus-visible tracking. Listeners for a click outside are added when an overlay opens.               |
| `@internationalized/date`, `number` | Used as they are                                                                                                                      |

The parts do not use `<dialog>`, the Popover API, `commandfor` or CSS anchor positioning. See [Decisions](#decisions).

#### What the compiler needs first

1. Conditional `preventDefault`. Done as `prevent(handler, 'ArrowDown', 'Enter')` from `brumate/events`, which the loader applies by key. See [Markup](../website/docs/markup.md#before-the-handler-loads).
2. Handlers in spreads. Done for the handlers that a caller passes on, which a spread writes into `b-on` with the scope of their owner and their wrappers. A part that makes its own handlers gives them with [`$handler`](../website/docs/components.md#handlers-that-a-script-makes), and markup that the browser renders gets the handlers of its spreads. See [Components](../website/docs/components.md#handlers-in-a-spread).
3. Components from packages. The Vite plugin finds `.brm` files only under the app root and skips `node_modules`, and component IDs come from the path under the root. A published package needs discovery from dependencies, and IDs that include the package name.

#### Questions to answer with a spike

Build `Select` from `Label`, `Button`, `SelectValue`, `Popover` and `ListBox` with context composition, slots, `as` and render props. It answers:

- Do parts that the caller passes as `children` read the contexts of `Select`? Children are rendered in the caller's scope and placed inside `Select`.
- What does `$getContext` return when no provider is above a part?
- Does markup that a `#template` prop rendered update when the state that the part passed to it changes?
- Can the `as` element get the part's handlers, ARIA attributes and focus, when `as` names a component?

Answers, from the spike in `packages/brumate/test/render/Spike*.brm` and the `Select spike` tests of `resume.test.ts`, where `it.fails` marks each gap:

- **Children read the contexts of the component they are passed to.** Done: the compiler renders `children` where the component inserts them, as layout routes render theirs. Their scopes keep the caller's for their values, and find contexts from the insert, which the page state sends as `t`.
- **Without a provider, `$getContext` gives the default value of the context,** on the server and in the browser, so a part on its own works. A default of `null` lets a part tell that it is alone.
- **A `#template` prop renders in the browser.** Done: the server sends it as a reference, `Page#t3`, to an export with its code, and the core calls it at once. The code starts to load when the page state is read, and updates wait for it.
- **An `as` component gets the handlers of the part and of the caller,** once handlers pass through spreads and dynamic tags (#31). ARIA attributes pass as attributes, and the `class` of a spread adds to the `class` of the element. Focus through `as` was not checked, since it needs a ref to the element of another component.

#### Plan

1. **Groundwork**, about a week:
   - `packages/ui` as `@brumate/ui`, a package of `.brm` components, as `examples/ui-kit` is.
   - The workbench counts a context with a default and a dynamic tag with a default element as self-contained, since every part reads the context of its parent and renders `as`.
   - Story files for the workbench, with named sets of props, so each part shows its states.
   - Helpers for keyboard and focus in tests, and `examples/ui`, a page of every part that `pnpm e2e` covers with axe-core.
2. **Phase 0**, the foundations, 3 to 4 weeks. The shared modules: the merge of a context with props, with chained handlers and `slot`, and press, hover and focus with their `data-*` state. `VisuallyHidden`, `Keyboard` and `I18nProvider`. It ends with `Button` on all of these, with the press tests of React Aria, in the workbench, and a guide to writing a part. It also answers whether focus passes through `as` when `as` names a component.
3. **Phases 1, 2 and 3**, the controls and fields, the overlays, and the collections with `Select`, in that order, as the roadmap below says.
4. **Phases 4 to 7**, as users ask for them.

Each phase ships with tests that follow the behaviour of React Aria, an accessibility check, docs in the `/ui` section of the website with live samples in the style of the site, stories in the workbench, and a check that a part that is closed or unused ships close to nothing.

`packages/ui` stays in this repository while the page format, IDs and spread rules still change. It moves to its own repository after 1.0 if its release pace differs from the compiler's.

#### Roadmap

The parts come from `react-aria-components` 1.22.1 (2026-10-09). Each phase ships when its parts have tests that follow React Aria's behaviour, an accessibility check, docs and live samples. A phase builds on the ones before it.

| Phase                      | Parts                                                                                                                                                                                                                                                                                                | Needs                                                                                                | Cost                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 0. Foundations             | Press, focus and hover handling (`Pressable`, `Focusable`), `VisuallyHidden`, `Keyboard`, `I18nProvider` (locale and direction), context composition with `slot`, `as`, render props and `data-*` state                                                                                              | The `Select` spike, conditional `preventDefault`, handlers in spreads                                | 3 to 4 weeks, with the compiler work |
| 1. Controls and fields     | `Button`, `ToggleButton`, `ToggleButtonGroup`, `Link`, `Label`, `Text`, `Input`, `TextArea`, `TextField`, `SearchField`, `Checkbox`, `CheckboxGroup`, `RadioGroup`, `Switch`, `FieldError`, `Form`, `Group`, `Separator`, `Heading`, `Toolbar`, `Breadcrumbs`, `Meter`, `ProgressBar`, `FileTrigger` | Phase 0. `Form` and `FieldError` use [`createForm`](../website/docs/forms.md#forms-with-createform). | 3 to 4 weeks                         |
| 2. Disclosure and overlays | `Disclosure`, `DisclosureGroup`, `Popover`, `OverlayArrow`, `Dialog`, `Modal`, `Sheet`, `Tooltip`, `PreviewTrigger`, `Toast`, and `Transition` from Terracotta                                                                                                                                       | Phase 1. `#portal`, and shared modules that place overlays, trap focus and close them.               | 5 to 6 weeks                         |
| 3. Collections             | The collection model (keys, sections with `Header`, disabled keys, single and multiple selection, typeahead, focus within a list), `ListBox`, `Menu` with submenus, `Select`, `ComboBox`, `Autocomplete`, `Tabs`, `TagGroup`, `GridList`, `SelectionIndicator`                                       | Phase 2 for the popovers of menus and selects                                                        | 6 to 8 weeks                         |
| 4. Numbers                 | `NumberField`, `Slider` with several thumbs                                                                                                                                                                                                                                                          | Phase 1, and `@internationalized/number`                                                             | 2 weeks                              |
| 5. Dates and times         | `Calendar`, `RangeCalendar`, `DateField`, `TimeField`, `DatePicker`, `DateRangePicker`                                                                                                                                                                                                               | Phases 2 and 3, and `@internationalized/date`                                                        | 4 to 6 weeks                         |
| 6. Data                    | `Table` with sorting, selection and column resizing, `Tree`, `NavigationTree`, `TokenField`, `Virtualizer`, drag and drop with `DropZone`, and list and tree data helpers                                                                                                                            | Phase 3                                                                                              | 6 to 8 weeks                         |
| 7. Color                   | `ColorPicker`, `ColorArea`, `ColorSlider`, `ColorWheel`, `ColorThumb`, `ColorField`, `ColorSwatch`, `ColorSwatchPicker`                                                                                                                                                                              | Phases 1 and 4                                                                                       | 3 to 4 weeks                         |

Notes for each phase:

- Phase 0 is most of the risk. It settles how a part merges its context with its props, how state reaches the caller's markup, and how `as` passes handlers and focus to a component. Every later part depends on it.
- Phase 1 parts are mostly markup and attributes, and many need no client code until they are used. A `Checkbox` is a native `<input type="checkbox">` with labels and states.
- Phase 2 renders every overlay with `#portal`, so it is above the page without the top layer of the browser. Shared modules do the rest:
  - placing a `Popover` or `Tooltip` next to its trigger, flipping it when it does not fit, when it opens and as the page scrolls or resizes;
  - moving focus into a `Dialog` or `Modal`, keeping it there, and giving it back to the trigger when it closes, as React Aria's `FocusScope` does;
  - closing on Escape and on a click outside, with listeners that are added when the overlay opens, as React Aria's `useInteractOutside` does;
  - hiding the rest of the page behind a `Modal` with `aria-hidden`, as React Aria's `ariaHideOutside` does, and locking its scroll, as its `usePreventScroll` does.
- Phase 2 animates with `Transition`, for overlays and for other content that is removed. `Transition` animates content that is removed, such as an `#if` body or a toast, which CSS cannot do because the node is gone. It follows [Terracotta](https://github.com/lxsmnsyc/terracotta)'s `Transition`: it keeps the content until its leave transition ends, then removes it. It takes Terracotta's `enter`, `enterFrom`, `enterTo`, `leave`, `leaveFrom` and `leaveTo` class props, and sets `data-closed`, `data-enter` and `data-leave` for CSS without class lists, as Headless UI does. It needs no compiler or runtime change: a signal of its own keeps the content mounted, and an `#if` removes it after `transitionend` or `animationend`, with a timeout when neither fires. The server renders the content as `show` says, with no animation on load. `prefers-reduced-motion` skips the wait. Nested `TransitionChild` coordination, and leave animations for `#for` items, which need a hook in the list code of the runtime, come later.
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

### Markdown with components

Markdown pages that can use brumate components and expressions, as mdsvex does for Svelte and MDX does for React. Content sites are mostly static, which is where resuming pays off most: a docs page ships no code unless a component on it has handlers.

- A `.md` page compiles to a `.brm` component. Front matter becomes its props or page metadata. Fenced code is highlighted at build time.
- The website already has a markdown plugin and live samples. They would become a general plugin that apps can use.

Cost: about 1 to 2 weeks, most of it for the parser integration, source maps and editor support.

### Order

Each step lists what it holds and why it comes there. A step can start before the one above it ends, when they touch different code.

1. **Caching**: done. Keys for calls that the browser sends again wait for the offline queue, and one render for all the holes of a prerendered page waits for a page with many.
2. **Streaming and tools**: reveal order, lists that grow in the browser and the devtools are done, except the history and a browser extension of the devtools, which wait for someone who needs them. Next is the component workbench, which is an exploration first.
3. **The UI components**, starting with the `Select` spike. They are the biggest project here, so they come after the steps that every app uses.
4. **Later, to explore**: server components and server templates. Check what the concept would give brumate: markup that renders only on the server and ships no code, such as a part that reads the database, and a `#template` that the server renders when the browser asks for it. Compare it with what `#defer`, server functions and resuming do already.
5. **When an app or the website needs them**: named view transitions, Markdown with components, two-way realtime, worker functions, offline pages, embedding, long lists, observability. Persisted signals are a cookie and an effect.

Content mappers for TypeScript 7 are in #3, which is open, so they are in no step.
