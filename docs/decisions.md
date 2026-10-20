# Decisions

## Decided

- The syntax follows solid-sfc. The semantics do not need to match Solid.
- Components run on the server only. The client resumes and never runs a component function again to rebuild state.
- The reactive graph is built at compile time. The runtime does not record subscriptions.
- There are seven compile-time functions: `$props`, `$signal`, `$memo`, `$ref`, `$watch`, `$client` and `$untrack`.
- `$signal` does not track the values in its initial value.
- `$watch` never runs on page load. `$client` is the way to run code without a change.
- Signals never leave the file. Imported code receives values.
- Server functions use the `'use server'` directive, on a function or on a file.
- Server functions may capture module-scope bindings and imports only.
- An async `$memo` may only call server functions.
- There is no `'use client'` directive.
- seroval is the serializer.
- The compiler splits client roots and server functions into modules itself. It does not use another splitter.

## Open

- **File extension.** `.brm` is a placeholder.
- **Lists.** Without `$store`, changing one item replaces the whole array, and keyed `#for` compares the lists. Large lists will need item-level updates.
- **Reusable logic.** Reactive logic shared between files, such as a `.brm.ts` module compiled with the same rules, is deferred.
- **Chunk size.** One chunk per handler gives the smallest download per event, but more requests. Grouping handlers that read the same scope may be better.
- **Streaming.** How state for scopes rendered after a `#loading` boundary is written into a streamed page.
- **Component summaries.** Whether they are written to files for the bundler, or computed by the bundler plugin across the module graph.
- **Effect order.** The order in which `$watch` callbacks run when one write changes several of them.

## Next steps

1. Write the grammar and the intermediate representation.
2. Build the parser and the analyzer, and test them on the graph output without a browser.
3. Write the server codegen with markers and state.
4. Write the client codegen and the loader. Measure the bytes for a counter and a todo list.
5. Add `#if` and keyed `#for`.
6. Add components and summaries.
