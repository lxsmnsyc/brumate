# Decisions

## Decided

- Components run on the server only. The client resumes and never runs a component function again to rebuild state.
- The reactive graph is built at compile time. The runtime does not record subscriptions.
- There are twelve compile-time functions: `$props`, `$signal`, `$memo`, `$effect`, `$client`, `$untrack`, `$produce`, `$isPending`, `$provide`, `$context`, `$id` and `$title`.
- `$id()` makes an ID from the scope's ID and the call's position, so server and client agree without counting at runtime.
- `ref=name` writes an element into a `$signal`. There is no separate ref function.
- `$signal` does not track the values in its initial value.
- `$effect` never runs on page load. It keeps Solid's name, but not its timing. `$client` is the way to run code without a change.
- Signals never leave the file. Imported code receives values.
- Server functions use the `'use server'` directive, on a function or on a file.
- Server functions may capture module-scope bindings and imports only.
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
- Any `$memo` can hold a promise, as in Solid, Compostate and Atemno. Reading a value that is still loading throws a not-ready error that carries the load, and nothing turns a memo into a promise. On the server, a memo computes when it is first read. A memo that read a loading value does not keep the error, so it computes again when read after the load. Markup outside every `#loading` body waits there, and a `#loading` body waits in its own stream chunk. On the client, a memo that reads a loading value keeps its old value and is pending until the value arrives.
- `$isPending(memo)` is true while a memo loads on the client, and false on the server.
- Routes are files under `src/routes`. A layout wraps its folder, and `@name` folders are sibling routes that render in the `name` slot of the layout for the same URL. Layouts render before their children, so their contexts reach the routes. The loader loads pages with `fetch` once it runs, and streams them in as they arrive. The code for it loads on the first navigation. A link keeps the layouts that stay the same, with their state, and replaces only the routes that change.
- seroval does not write or read regular expressions, in the page state or in server function calls. A pattern from a client could take the server a long time to match. Error stacks are not written either.
- Server function calls and form posts from a page of another site answer 403. The check reads `Origin`, or `Sec-Fetch-Site` without it, so forms need no token.
- `$action(fn)` holds the result of a form. Without scripts the page renders again with it, and with the loader it is written into the page. `refresh(fn)` in a server function loads again the memos that call `fn`, which the compiler finds.
- A form posts to a server function with `action=fn`, without client code. The server answers with a 303 back to the page, so the page renders again with the new data.
- The project is named brumate, and its files use `.brm`. Brumation is how reptiles stay dormant in the cold and resume when it warms, as a page resumes on its first event without hydrating.
- Compile-time functions such as `$signal` are imported from `brumate/signals`, not global. The compiler finds them through the import, so a renamed import works and their types reach only the files that import them. The compiler removes the import.
- Server rendering streams only. `renderToStream` sends the whole first render at once, closing tags included, and streams what resolves later after it, as Solid does. `render` returns the parts for custom servers. There is no `renderToString`, because waiting for every `#loading` body defeats streaming.
- A component can render the whole document. The runtime adds the doctype, and puts the head before `</head>` and the state, scripts and portals before `</body>`.
- `render` and `renderToStream` take a `nonce` for the inline swap scripts. State scripts need none, because the browser does not run them.
- Styles are scoped with an `s-<hash>` attribute. Style variables are custom properties on the component's top-level elements, and the stylesheet is inlined once per page.
- There is no `$store`. Objects and arrays in signals change by assigning a new value, or with `$produce`, which changes a draft and shares what it does not change. Reads stay per signal, so the graph stays static and nothing extra is resumed. A keyed `#for` compares the old and new lists and updates only the items that changed.
- Server functions read the request with `getRequest`, set response headers with `getResponseHeaders`, and answer with `ServerError` and `redirect`. Other errors reach the browser as a generic message.
- Errors in the page state keep their name and message only.
- Contexts are named by a key that is the same on the server and the client. The page state links each component to the scope that rendered it, records provided values and the slots of readers, so the client finds providers without running code.
- The head is `$title` and `#head` blocks. `renderToStream` puts it before `</head>`, or passes it to `start`, and `render` returns it. A `$title` or `#head` in a `#loading` body that resolves after the first render streams with the body. A script moves it into the head and sets the title.
- seroval is the serializer. The page state is a stream of cross-reference JSON records, so promises do not hold up the state, and the client reads it without `eval`. Server function calls use plain seroval JSON.
- Scope IDs are integers given in render order. A render can start above another one with `base`, so several roots and pages that the client loads in place never share IDs.
- A child component keeps its props in its own slots. The parent links to the child's scope to update them.
- The compiler splits client roots and server functions into modules itself. It does not use another splitter. A component whose parts are small in all ships them as one module, because one request costs more than the bytes it saves.
- A component's stylesheet is inlined before its first instance on the page, so a page carries only the CSS of what it renders. There is no CSS file of every component, because it would load CSS that the page does not use and block rendering.
- A dynamic tag is a `#key` block on its tag, so a new element name or component renders again. A component in the page state is written as its ID. The client code that changes the value uses the component's render module.
- Effects run after the other updates of a write, once each, so they see the new markup and every new memo value.
- The type checker reports a signal or memo that the client reads and whose type seroval cannot write, such as a function or a class instance with methods.
- `.brm` files are type-checked through generated TypeScript, with a Volar language plugin. `brumate-tsc` checks a project, and `@brumate/typescript-plugin` serves editors.
- `children` ship as the HTML that the server rendered. When the client inserts them again, it runs the updates of the scopes in them, so the values are current. Updates to markup that is not in the page do nothing.
- Changing a reactive value in place, such as `todos.push(todo)` or `todo.done = true`, is a warning. Nothing updates, because the value is the same. `$produce(todos, (draft) => { draft.push(todo) })` is the way to write it.

## Open

- **Reusable logic.** Reactive logic shared between files, such as a `.brm.ts` module compiled with the same rules, is deferred.
- **Core size.** The core is about 10.8 KB gzip. seroval's state reader alone is about 4 KB, and its serializer about 7 KB, but seroval is one module, so a bundler puts everything that any chunk uses into one shared chunk. Separate entry points in seroval for reading and writing would let the core load only the reader, about 7.5 KB in all. The server function code is already a separate chunk for this.

## Next steps

1. Write the grammar and the intermediate representation. Done in [Grammar](./grammar.md) and [Intermediate representation](./ir.md).
2. Build the parser and the analyzer, and test them on the graph output without a browser. Done in [`packages/brumate`](../packages/brumate).
3. Write the server codegen with markers and state. Done. See [Page format](../website/docs/page-format.md).
4. Write the client codegen and the loader. Measure the bytes for a counter and a todo list. Done. See [Compiler](./compiler.md#size).
5. Split client modules per handler and per update. Done. See [Code splitting](./compiler.md#code-splitting).
6. Render components on the client, inside blocks that change. Done. See [Render modules](./compiler.md#render-modules).
7. Add a Vite plugin that serves the modules and answers server function calls. Done. See [Vite](../website/docs/reference-plugin.md).
8. Add component summaries. Done as a project analysis in the Vite plugin. See [Props across files](./compiler.md#props-across-files).
