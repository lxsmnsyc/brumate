# Client modules

What the browser loads, and when: the loader, the core, the parts of each component, and the modules for navigation and server calls. [Reactive graph](./reactive-graph.md) describes what goes into the parts.

## Before the first event

The page arrives as HTML with its state in scripts. The only module that runs is the loader, `brumate/loader`, from the client entry:

```ts
// src/client.ts
import 'virtual:brumate/start';
```

The loader:

- Listens on `document` to the events named in `b-on` attributes, and walks from the target outwards to find a handler.
- Applies event modifiers, such as `:prevent`, before anything loads.
- Adds the `<window>` and `<document>` listeners, and starts `$client` callbacks and `#client` blocks when their trigger fires.
- Preloads the code of an element's handlers according to its `prefetch` attribute.
- After the page loads, when the browser is idle, preloads the core and the code of the handlers of elements in or near the viewport. See [Idle preload](#idle-preload).
- Watches the page for added markup, such as `#loading` bodies, and listens to its handlers too.

## The first event

On the first event, the loader imports the core, `brumate/client`, and the client entry of the component that handles the event. The core:

- Reads the state records that the page's scripts handed over, and links each scope to its parent.
- Calls the handler with the scope of its element.
- Writes slots, and runs the updates that read them.
- Finds elements by `b-b`, and text and blocks by their comment markers.
- Renders block bodies, keeps the elements of list items whose keys stay, and removes the scopes of removed markup.
- Runs `$effect` and `$client` callbacks and their cleanups.

The core holds only the helpers that the build's components call. A build without `#for`, `$produce` or `$optimistic` leaves their code out, and a build with `navigate: false` leaves out the code that reads the pages that navigation adds. That code loads after the first client navigation, as a small module of its own.

Handlers run after the event has finished dispatching. The core passes them an event whose `currentTarget` is still the element. Parts load in parallel, but handlers start in the order of their events, so typing and then submitting runs the input handler before the submit handler.

## Parts

The compiler splits the client code of each component into parts. The bundler loads a part as `App.brm?brumate-client&part=<name>`.

| Part             | Holds                                                                      | Loads                                         |
| ---------------- | -------------------------------------------------------------------------- | --------------------------------------------- |
| Entry, `App.brm` | The component ID, the props map, the update table `g`, and `load(part)`    | On the first use of the component             |
| `h<n>`, `c<n>`   | One client root: an event handler, a function prop or a `$client` callback | On its event or trigger                       |
| `update`         | Memos, bindings, block updates, effects, list helpers and render functions | On the first write that reaches the component |
| `shared`         | Functions that more than one part calls, and the module script             | With the parts that import it                 |

- A local function that only one part calls goes into that part.
- Each part imports only what its code reads. Server function stubs are copied into each part that calls them.
- The core finds an export by its name: `h<n>` and `c<n>` are in the part of the same name, and everything else is in `update`.

### `merge`

When the parts of a component are smaller than the `merge` option in all, after minifying, the entry holds their code and has no `load`. The first event then loads one module instead of several. Components with a `shared` part keep their parts. The plugin merges below 2048 bytes by default. `compile` does not merge unless asked.

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

## Prefetch

| `prefetch`             | Loads the core and the parts of an element's handlers      |
| ---------------------- | ---------------------------------------------------------- |
| `"hover"`, the default | When the pointer moves over the element, or it gets focus. |
| `"visible"`            | When the element enters the viewport.                      |
| `"idle"`               | When the browser is idle after the page loads.             |
| `"none"`               | Never. The event loads them.                               |

### Idle preload

After the `load` event, when the browser is idle, the loader preloads the core and the code of the handlers of elements in or near the viewport, and of elements that come near it later. A click after that needs no request. It does not load anything before `load`, and it does not block the page.

It skips:

- Elements with `prefetch="none"`.
- Browsers that ask to save data, with `navigator.connection.saveData`.
- Connections whose `effectiveType` is `2g` or `slow-2g`.

The plugin's [`preload`](./reference-plugin.md#options) option, or the loader's `preload` option, turns it off.

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
