# Client modules

What the browser loads, and when: the loader, the core, the parts of each component, and the modules for navigation and server calls. [Reactive graph](./reactive-graph.md) describes what goes into the parts.

## When the page starts

The page arrives as HTML with its state in scripts. The client entry runs the loader, `brumate/loader`:

```ts
// src/client.ts
import 'virtual:brumate/start';
```

The loader:

- Listens on `document` to the events named in `b-on` attributes, and walks from the target outwards to find a handler.
- Applies the wrappers of `brumate/events`, such as `prevent`, before anything loads.
- Adds the `<window>` and `<document>` listeners, and starts `$client` callbacks and `#client` blocks when their trigger fires.
- Imports the core, `brumate/client`, at once.
- Watches the page for added markup, such as `#loading` bodies, and listens to its handlers too.

The core reads the state records that the page's scripts handed over, and links each scope to its parent. It does not render the page again. For each component that has a scope on the page, it loads the client entry and all of its parts. A component that the browser renders later, such as in an `#if` body, loads its code when its scope is made.

## Bundles

A build groups the client code by root components: the components that no other component imports, such as routes, layouts and pages. The bundle of a root holds the client entries and the parts of every component that it can render, so the code of a page comes in one chunk, with the chunks that it shares with other pages.

- The loader starts the bundles of the components in the page state at once, with the core.
- A page of `handleRoute` gets `<link rel="modulepreload">` for the loader, the core and the bundles of its route and layouts, so they download with the HTML.
- The dev server loads each component's module on its own, so an edit updates the page in place.

## Events and calls

An event that comes before the code of the page has loaded waits for it. Then the core:

- Calls the handler with the scope of its element.
- Writes slots, and runs the updates that read them.
- Finds elements by `b-b`, and text and blocks by their comment markers.
- Renders block bodies, keeps the elements of list items whose keys stay, and removes the scopes of removed markup.
- Runs `$effect` and `$client` callbacks and their cleanups.

A function of another component, such as a function prop, a function in a context or a `#template`, is the loaded function. A call runs at once and returns its result, as in Svelte and Solid, and calls run in the order that they are made.

The core holds only the helpers that the build's components call. A build without `#for`, `$produce` or `$optimistic` leaves their code out, and a build with `navigate: false` leaves out the code that reads the pages that navigation adds. That code loads after the first client navigation, as a small module of its own.

The body of an `#if` or a `#for` whose markup is elements, attributes, text and `#if` or `#for` blocks compiles to a `<template>`. The browser parses it once, clones it for each render, and writes the values on the elements that the template marks, with no HTML to build or parse. A text value is a text node, which an update sets, as in Solid. The blocks inside fill before the clone goes into the page. A child component renders in its place in the clone, and the render module of a component whose markup is one string clones a template too. Other markup renders HTML, such as a component whose markup holds blocks.

The client build also leaves out the code of the features that no component uses:

- children that the browser renders, `#template` values that it calls, `<title>` in markup, and `$bind` passed to another component;
- markup that comes after the page, from `#loading`, `#defer`, lists that stream and client navigation;
- `$client` callbacks and `#defer` blocks, handlers of the window or the document, and forms of an `$action`.

An app that compiles components in the browser, such as a REPL, sets `features: 'all'` in the plugin options, so it keeps them.

Handlers run after the event has finished dispatching. The core passes them an event whose `currentTarget` is still the element.

## Parts

The compiler splits the client code of each component into parts. The bundler loads a part as `App.brm?brumate-client&part=<name>`.

| Part             | Holds                                                                               | Loads                         |
| ---------------- | ----------------------------------------------------------------------------------- | ----------------------------- |
| Entry, `App.brm` | The component ID, the props map, the update table `g`, and the exports of each part | With the page                 |
| `h<n>`, `c<n>`   | One client root: an event handler, a function prop or a `$client` callback          | With the page                 |
| `update`         | Memos, bindings, block updates, effects, list helpers and render functions          | With the page                 |
| `shared`         | Functions that more than one part calls, and the module script                      | With the parts that import it |

- A local function that only one part calls goes into that part.
- Each part imports only what its code reads. Server function stubs are copied into each part that calls them.
- The entry exports the exports of every part, so the core finds an export by its name on the entry.

### `merge`

When the parts of a component are smaller than the `merge` option in all, after minifying, the entry holds their code itself. Otherwise the entry exports them from modules of their own. Components with a `shared` part keep their parts. The plugin merges below 4096 bytes by default. `compile` does not merge unless asked.

- A build puts the entry and the parts in the chunk of a bundle either way, so `merge` does not change how many requests a page makes.
- On the dev server, each part is a request of its own, so merging small components makes fewer requests.

A component with no client code has no parts, and a build leaves it out of the client.

### Render modules

`App.brm?brumate-render` renders a component in the browser, for a parent whose block renders it again. A parent imports it only from the code of such a block.

### Shared code of module functions

A component copies the body of a [module function](./reactive-modules.md) that it calls, so its signals are slots of the component. The code of that body that runs in the browser is not copied into the parts. It is compiled once, into `counter.brm.ts?brumate-shared`:

```ts
// counter.brm.ts?brumate-shared
export function s218($$s, $$k) {
  const $$c = $$b.cells($$s, $$k, ['count']);
  $$c.count++;
}
```

```ts
// A part of the component
const increment$ = ($$s, ...$$a) => $$m0.s218($$s, [1], ...$$a);
```

- Each export is a function of the body, a function that it returns, a memo, or an effect, named by its offset in the module.
- `$$k` holds a ref for each name that the code reads or writes: a slot of the scope, `[scope, slot]` for a slot of another scope, or `[value]` for a literal argument or a value that does not change. `cells` turns the refs into getters and setters.
- Code that needs the component to compile it, such as `$isPending`, is copied instead. So is the code of a module function that another module function calls.

## Navigation and server calls

These load as their own small modules, on first use:

- The navigation module loads on the first click on a link to the same origin. A page also starts to load when the pointer rests on its link for 80 ms, or when the link gets focus. A click within 10 seconds uses that response.
- The server call module loads on the first call of a server function. It holds the serializer of the arguments and the reader of the [chunk stream](./server-protocol.md#chunk-stream).

## Order of a streamed page

1. The first chunk is the whole first render, from `<!doctype html>` to `</html>`, with the fallbacks of `#loading` blocks. The head of the components goes before `</head>`. The page state, the `scripts` option and portal content go before `</body>`.
2. The client entry should be an `async` module script, so the loader starts before the stream ends.
3. Each `#loading` body, and each state record that settles a promise, follows as it is ready. These chunks come after `</html>`, and the parser of the browser moves them into `<body>`.
4. The swap script of a `#loading` body moves it into place. The core reads its state record when the record runs, or when the core starts.

## Modules of the plugin

| Import                                 | What it is                                                            |
| -------------------------------------- | --------------------------------------------------------------------- |
| `./App.brm` on the server              | The server module. Its default export renders the component.          |
| `./App.brm` in the browser             | The client entry.                                                     |
| `./App.brm?brumate-client&part=<name>` | A part of the client module.                                          |
| `./App.brm?brumate-render`             | The render module.                                                    |
| `./App.brm?brumate-server`             | The server module, where the client one would load, such as in tests. |
| `virtual:brumate/manifest`             | `load(id)`, which imports the client entry of a component by ID.      |

The plugin finds `.brm` files under the root when the build starts, and again when files are added or removed. Component IDs come from the path relative to the root, so they are the same on every machine. A change to any `.brm` file in development finds which props can change again, and updates the page. See [Edit while it runs](./getting-started.md#edit-while-it-runs).
