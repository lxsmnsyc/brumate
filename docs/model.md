# Execution model

A component runs once, on the server. The client never runs it again. It resumes from the state that the server serialized into the page.

## Hydration and resumption

With hydration, the client runs every component again to rebuild its state and attach event listeners. All component code ships, even code that only ever renders once.

With resumption:

- The server writes the state, the event handler locations and the markers for dynamic parts into the HTML.
- The client loads a small loader that listens to events on `document`.
- When an event fires on an element with a handler, the loader imports that handler's chunk, reads the state it needs and runs it.
- No component function runs on the client unless the client creates a new instance, such as a new `#for` item.

## Client roots

Code runs in the browser only if it starts from a client root:

- Event handlers on elements, such as `onClick`.
- `<window>` and `<document>` listeners.
- `$effect` callbacks.
- `$client` callbacks.
- Functions passed as props to a component, such as `onChange=((value) => (count = value))`.
- The create code of a block that the client must render, such as an `#if` whose condition can change.

The compiler starts at each client root and follows what it reads, writes and calls. Everything it reaches ships. Everything else stays on the server.

## Static reactive graph

The compiler builds the dependency graph at compile time. It does not record subscriptions at runtime.

- A node is a `$signal`, a `$memo`, a prop, a binding in the markup, a block condition or list, or a `$effect`.
- An edge exists when a node reads another node by name.
- Reads through local functions are followed within the file.
- `$untrack(expression)` reads without adding an edge.

When a client root writes a signal, the runtime marks the nodes downstream of it and updates them in order. It needs the graph for that signal, not the whole component.

## What the compiler decides for each node

| Node                              | Ships to the client when                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `$signal`                         | A client root writes it. Its value is serialized.                                                                                           |
| `$memo`                           | Something upstream is writable on the client. Its value is serialized, so it is not computed again on resume.                               |
| `$memo` that returns a promise    | Something upstream is writable on the client. Then it runs again on the client, and the page keeps the old value until the promise settles. |
| Markup binding, such as `{count}` | Its source is writable on the client.                                                                                                       |
| `#if`, `#switch`, `#key`          | Its condition is writable on the client. Then the branch templates ship.                                                                    |
| `#for`, `#repeat`                 | Its list or count is writable on the client. Then the item template ships.                                                                  |
| Static text and elements          | Never. They are HTML only.                                                                                                                  |

A signal that no client root writes is a constant after the server renders it. It is not serialized.

## Serialization

Anything that client code reads must be serialized. The supported types are:

- Primitives, including `bigint`, `undefined`, `NaN` and `Infinity`.
- Plain objects and arrays. Shared and cyclic references are kept.
- `Date`, `Map`, `Set`, `URL`, `URLSearchParams` and typed arrays. Regular expressions are not sent, because a pattern from a client could take the server a long time to match. Send the source and the flags instead.
- Signals and memos, as references to a scope slot.
- Elements, as references to their marker.
- Client functions, such as handlers, server function stubs and module exports, as references to a chunk and an export name.
- Promises. The server awaits them, or streams the value later.

A client root that captures any other value is a compile error. The error shows the capture:

```
Handler "submit" captures "db" (Todos.brm:4:9), which cannot be serialized.
Call it from a server function, or create it in <script module>.
```

[seroval](https://github.com/lxsmnsyc/seroval) already supports these types, references and streamed promises, so it is the planned serializer.

## Scopes

Each component instance and each block body with its own `<script>` is a scope. A scope has an ID, such as `0` for the root component and `0.1` for the second item of a `#for` in it. Elements with handlers point to their scope with an attribute, so the runtime can find the scope's state when a handler runs.

Scopes are read from the state script lazily. A handler that only touches one `#for` item reads only that item's scope.

## Synchronous event behavior

A handler chunk loads asynchronously, so it cannot call `event.preventDefault()` in time. Modifiers in the markup handle this instead:

```html
<form onSubmit:prevent=add>
<a href="/next" onClick:prevent:stop=go>
```

The loader applies them before it imports the handler.

The handler runs after the event has finished dispatching. The core keeps `event.currentTarget` set to the element, so handlers can read it as usual.

## Prefetching

The first interaction waits for the handler chunk to load. To hide that delay, the loader preloads a handler's chunk before the event. The default is to preload on `pointerenter` and `focus`. A `prefetch` attribute changes it:

```html
<button onClick=buy prefetch="visible">Buy</button>
```
