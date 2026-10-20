# Decisions

## Decided

- The syntax follows solid-sfc. The semantics do not need to match Solid.
- Components run on the server only. The client resumes and never runs a component function again to rebuild state.
- The reactive graph is built at compile time. The runtime does not record subscriptions.
- There are six compile-time functions: `$props`, `$signal`, `$memo`, `$effect`, `$client` and `$untrack`.
- `ref=name` writes an element into a `$signal`. There is no separate ref function.
- `$signal` does not track the values in its initial value.
- `$effect` never runs on page load. It keeps Solid's name, but not its timing. `$client` is the way to run code without a change.
- Signals never leave the file. Imported code receives values.
- Server functions use the `'use server'` directive, on a function or on a file.
- Server functions may capture module-scope bindings and imports only.
- An async `$memo` may only call server functions.
- There is no `'use client'` directive.
- There is no `#static` block. Markup is static by default, so marking it changes nothing. `brumate inspect` reports what ships and why instead.
- Scripts, expressions and attribute values cannot contain markup. `#for` and `#template` are used instead.
- Props are live only if a parent passes them values that can change. The project analysis finds these props. A file compiled alone treats every prop as live.
- The client code of a component is split into an entry, one part per client root, an update part and a shared part.
- Scope instances link to their parent with `p`, so client code reads outer values by walking up.
- Lists keep the raw item of each item scope in the state, so keys can be computed again on the client.
- The Vite plugin finds every `.brm` file under the root, so the manifest and the server registry list all components.
- A change to a `.brm` file reloads the page instead of replacing modules.
- A component rendered on the client comes from its render module, a third output next to the server and client modules.
- `#loading` streams out of order: the fallback first, then the body in a `<template>` with its scopes and an inline swap script.
- An async `$memo` is a promise on the server. It is awaited where it is declared only if something outside every `#loading` body reads it.
- `renderToString` and `renderToStream` take a `nonce` for the inline swap scripts. State scripts need none, because the browser does not run them.
- seroval is the serializer. The page state is a stream of cross-reference JSON records, so promises do not hold up the state, and the client reads it without `eval`. Server function calls use plain seroval JSON.
- Scope IDs are integers given in render order.
- A child component keeps its props in its own slots. The parent links to the child's scope to update them.
- The compiler splits client roots and server functions into modules itself. It does not use another splitter.

## Open

- **File extension.** `.brm` is a placeholder.
- **Lists.** Without `$store`, changing one item replaces the whole array, and keyed `#for` compares the lists. Large lists will need item-level updates.
- **Reusable logic.** Reactive logic shared between files, such as a `.brm.ts` module compiled with the same rules, is deferred.
- **Chunk size.** One part per handler gives the smallest download per event, but more requests. On small components, one module is smaller overall. A size threshold below which a component keeps one module may be better.
- **Mutation.** `todos.push(todo)` changes a signal's value without writing the signal, so nothing updates. The analyzer does not report it yet.
- **Serializable captures.** Checking that client code only captures serializable values needs type information. The analyzer does not check it yet.
- **Async `$memo`.** A memo is async when it awaits or calls a server function in the same file. A call to an imported function that returns a promise is not detected.
- **Children.** `children` is rendered on the server and passed as HTML. It serializes as an empty value, so the client cannot render it again.
- **`#portal`.** The server renders the body in place.
- **Styles.** `<style>` blocks are parsed but not compiled yet.
- **Dynamic components on the client.** A dynamic tag whose value changes on the client is an error. A component value cannot be serialized, so a dynamic tag can only render a component on the client when the value is known there.
- **Async on the client.** An async `$memo` that changes on the client is an error for now.
- **Core size.** The core is about 10.8 KB gzip. seroval's state reader alone is about 4 KB, and its serializer about 7 KB, but seroval is one module, so a bundler puts everything that any chunk uses into one shared chunk. Separate entry points in seroval for reading and writing would let the core load only the reader, about 7.5 KB in all. The server function code is already a separate chunk for this.
- **Stale streamed bodies.** A `#loading` body is rendered with the values of the server. If the client changes a value before the body arrives, the body shows the old value until the value changes again.
- **Effect order.** The order in which `$effect` callbacks run when one write changes several of them.

## Next steps

1. Write the grammar and the intermediate representation. Done in [Grammar](./grammar.md) and [Intermediate representation](./ir.md).
2. Build the parser and the analyzer, and test them on the graph output without a browser. Done in [`packages/brumate`](../packages/brumate).
3. Write the server codegen with markers and state. Done. See [Page format](./page-format.md).
4. Write the client codegen and the loader. Measure the bytes for a counter and a todo list. Done. See [Compiler](./compiler.md#size).
5. Split client modules per handler and per update. Done. See [Code splitting](./compiler.md#code-splitting).
6. Render components on the client, inside blocks that change. Done. See [Render modules](./compiler.md#render-modules).
7. Add a Vite plugin that serves the modules and answers server function calls. Done. See [Vite](./vite.md).
8. Add component summaries. Done as a project analysis in the Vite plugin. See [Props across files](./compiler.md#props-across-files).
