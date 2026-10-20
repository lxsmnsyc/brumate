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
- Scripts, expressions and attribute values cannot contain markup. `#for` and `#template` are used instead.
- A component treats every prop as live. Update code for props loads only when a parent writes one. Component summaries are an optional optimization.
- The client module of a component is one module for now. The loader imports it on the first event for that component.
- Scope instances link to their parent with `p`, so client code reads outer values by walking up.
- Lists keep the raw item of each item scope in the state, so keys can be computed again on the client.
- seroval is the serializer. The state is seroval JSON, so the client reads it without `eval`.
- Scope IDs are integers given in render order.
- A child component keeps its props in its own slots. The parent links to the child's scope to update them.
- The compiler splits client roots and server functions into modules itself. It does not use another splitter.

## Open

- **File extension.** `.brm` is a placeholder.
- **Lists.** Without `$store`, changing one item replaces the whole array, and keyed `#for` compares the lists. Large lists will need item-level updates.
- **Reusable logic.** Reactive logic shared between files, such as a `.brm.ts` module compiled with the same rules, is deferred.
- **Chunk size.** One chunk per handler gives the smallest download per event, but more requests. Grouping handlers that read the same scope may be better.
- **Streaming.** How state for scopes rendered after a `#loading` boundary is written into a streamed page.
- **Component summaries.** Whether they are written to files for the bundler, or computed by the bundler plugin across the module graph. They are not needed for correct output.
- **Mutation.** `todos.push(todo)` changes a signal's value without writing the signal, so nothing updates. The analyzer does not report it yet.
- **Serializable captures.** Checking that client code only captures serializable values needs type information. The analyzer does not check it yet.
- **Async `$memo`.** A memo is async when it awaits or calls a server function in the same file. A call to an imported function that returns a promise is not detected.
- **Children.** `children` is rendered on the server and passed as HTML. It serializes as an empty value, so the client cannot render it again.
- **`#portal`.** The server renders the body in place.
- **Styles.** `<style>` blocks are parsed but not compiled yet.
- **Client rendering.** Components, dynamic tags and templates from outer scopes cannot render inside a block that changes on the client yet. The compiler reports an error.
- **Async on the client.** An async `$memo` that changes on the client is an error for now.
- **Core size.** The core is about 10 KB gzip, mostly seroval. Reading the state lazily, or a smaller reader, would cut it.
- **Effect order.** The order in which `$effect` callbacks run when one write changes several of them.

## Next steps

1. Write the grammar and the intermediate representation. Done in [Grammar](./grammar.md) and [Intermediate representation](./ir.md).
2. Build the parser and the analyzer, and test them on the graph output without a browser. Done in [`packages/brumate`](../packages/brumate).
3. Write the server codegen with markers and state. Done. See [Page format](./page-format.md).
4. Write the client codegen and the loader. Measure the bytes for a counter and a todo list. Done. See [Compiler](./compiler.md#size).
5. Split client modules per handler and per update, as described in [Code splitting](./compiler.md#code-splitting).
6. Render components on the client, inside blocks that change.
7. Add a Vite plugin that serves the modules and answers server function calls.
8. Add component summaries.
