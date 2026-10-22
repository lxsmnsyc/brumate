# Decisions

## Decided

- Components run on the server only. The client resumes and never runs a component function again to rebuild state.
- The reactive graph is built at compile time. The runtime does not record subscriptions.
- There are twelve compile-time functions: `$props`, `$signal`, `$memo`, `$effect`, `$client`, `$untrack`, `$produce`, `$isPending`, `$setContext`, `$getContext`, `$id` and `$title`.
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
- `render` and `renderToStream` take a `nonce` for the inline scripts: the state records and the swap scripts.
- Styles are scoped with an `s-<hash>` attribute. Style variables are custom properties on the component's top-level elements, and the stylesheet is inlined once per page.
- There is no `$store`. Objects and arrays in signals change by assigning a new value, or with `$produce`, which changes a draft and shares what it does not change. Reads stay per signal, so the graph stays static and nothing extra is resumed. A keyed `#for` compares the old and new lists and updates only the items that changed.
- Server functions read the request with `getEvent()`, and answer with `ServerError` and `redirect`. Other errors reach the browser as a generic message.
- `getEvent()` works before the first `await` of a server function, middleware or endpoint, and anywhere in a component while it renders. The runtime sets the event while it starts a call and clears it right after, so it never needs `AsyncLocalStorage`, and never returns the event of another request. Code keeps the event in a variable and passes it to helpers.
- Errors in the page state keep their name and message only.
- Contexts are named by a key that is the same on the server and the client. The page state links each component to the scope that rendered it, records provided values and the slots of readers, so the client finds providers without running code.
- The head is `$title` and `#head` blocks. `renderToStream` puts it before `</head>`, or passes it to `start`, and `render` returns it. A `$title` or `#head` in a `#loading` body that resolves after the first render streams with the body. A script moves it into the head and sets the title.
- seroval is the serializer. The page state is a stream of seroval cross-reference code records, one inline script each, so promises do not hold up the state. Server function calls use seroval JSON.
  - Each record hands a function of its values to `self.$brm`. The core calls it when it starts, so a page that never gets an event never builds its state.
  - The browser runs the scripts, which is not `eval`. Under a Content Security Policy they need the `nonce` of the render.
  - The code is smaller than the JSON nodes and faster to write. On the `/` page of `examples/todos`, the state is 673 B instead of 1485 B, and the benchmark renders about 1.5 times as many pages per second.
  - The core does not need seroval's reader for the page, so seroval loads with the first server function call. The core is 7.6 KB gzip instead of 15 KB.
  - Records of scopes with the same kind, parent and shape, such as the items of a list, go in one flat array per group. Each item then costs its slots and the gap to the ID before it, instead of an object with `k`, `p`, its slots array and a copy of its item. The core rebuilds the records when it reads the page. In the benchmark, one more todo costs 214 B of HTML instead of 254 B, 26 B gzip instead of 36 B, and 100 todos render about 1.4 times as fast. The core grows by 148 B gzip.
  - A `#for` item whose list is a signal, memo or prop of a scope around it does not write its item. The core sets it from that list by the item's position in its group. An item cannot change on its own: the analyzer rejects a write to a loop variable, and a change in place changes the object that the list holds too. The server checks that each item is the value at its position in the list, and writes the items when one is not, when the list is in an earlier record, or when it is not an array or a Set. Computed lists, such as `todos.filter(…)`, and lists of a value in an item keep their items, because the client would have to compute them again. On the todos benchmark, the state for 100 todos drops from 5.9 kB to 5.2 kB, and one more todo costs 164 B of HTML instead of 172 B.
  - The kind and the parent of an item are not read from the markers in the page. The core reads the state before it has the components' code, and markers carry only the scope ID, so they would need more bytes for the same information.
- Markup marks less when the compiler can show that the core still finds what it needs. In the benchmark, one more todo costs 174 B of HTML instead of 214 B, 20 B gzip instead of 26 B. The core grows by about 80 B gzip, and the loader does not change.
  - A live insert that is the whole content of an element updates the element's children through the element's `b-b`, with no `<!--t…-->` and `<!--/t-->`.
  - A list item whose body is one element is marked by that element's `b-b`, with no `<!--i…-->` and `<!--/i-->`. The element gets an anchor for it if it has none.
  - An element with handlers and no other client code has no `b-b` when an element around it in the same scope has one. Its handlers find their scope with `closest`.
  - The last two apply only to elements that the HTML parser keeps whole. A `<p>` ends at a `<div>` that a child component renders, and a `<table>` moves out content that does not belong in it. The comments, or an anchor of its own, still work then.
  - `b-on` keeps the component ID in each entry. Without it the loader would need the scope's component before the core reads the state, so the module could not load in the same round trip as the core, or every page would need a table of IDs. Leaving it out would save 12 B of HTML per todo, but only about 0.2 B gzip, because the repeated text compresses well.
  - Elements that only an update needs still get their own `b-b`. Finding them by a path from an element around them would save about 3 B gzip per todo, but a path breaks when the parser moves or splits elements.
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
- The core is one module whose helpers are exports of their own, and the loader reads only its `loader` export, so a build keeps the helpers that its components call and leaves out the rest. Features that change how the core reads the page, such as the pages that client navigation adds and hot updates, are modules that set hooks of the core when they load, and they read the core with `import()`. The cost is a few bytes in the loader to load them, and a small chunk after the first client navigation. A core per page would need a chunk per set of features, and more requests.
- After `load`, when the browser is idle, the loader preloads the core and the handlers' code of elements in or near the viewport, so a first click needs no request. It costs 97 B gzip in the loader, and the bytes of the core and the modules on every page that has handlers, even when nobody clicks. `prefetch="none"`, Save-Data, 2G connections and the `preload: false` option turn it off.
- Server functions validate their arguments with helpers of `brumate/server` that take any Standard Schema: `parse`, `safeParse`, `parseForm` and `fieldErrors`. The function calls them in its body.
  - A helper needs no compiler change, and works the same in a component and in a `'use server'` file. The schema and the helper stay on the server, because only the body of the server function reads them.
  - A wrapper, such as `validated(schema, fn)`, would hide the server function from the compiler, which finds server functions by their `'use server'` directive.
  - Validators that the compiler generates from the TypeScript types would need the type checker in every build, and could not express rules such as an email or a minimum.
  - The Standard Schema interface is copied into the package, as its authors ask, so brumate has no dependency for it and works with Zod, Valibot, ArkType and others.
  - `parse` throws a `ServerError` with status 400 and the first issue as the message. The issues are not sent with the error, so the protocol of errors and the client do not change. A function that wants to show field errors uses `safeParse` or `parseForm` and returns the issues as a value.
  - Issues are copied as plain data, a message and a path of strings and numbers, so seroval can send them and fields that a library adds, such as the input, stay on the server.
  - `parseForm` nests dotted names into objects, and makes arrays of repeated names and names that end with `[]`. A part named `__proto__`, `constructor` or `prototype` is an issue, so a form cannot change a prototype.
- `#offscreen (visible) { … }` hides its body and keeps it in the page, as React's `<Activity mode="hidden">` does.
  - A body that is hidden when the page renders is not rendered. The client renders it the first time it shows, as it renders an `#if` body. Hidden content costs nothing until it is needed.
  - The client hides each node at the top level of the body. An element gets an inline `display: none !important`, and a text node gets empty text. The element's own inline `display` comes back when the body shows.
  - The nodes stay in the page. Removing them would reload iframes, stop videos, and lose focus, the selection and the scroll inside them.
  - It is not the `hidden` attribute. A stylesheet such as `.panel { display: flex }` overrides the `[hidden]` rule of the browser, and the body would show. An inline `!important` declaration wins over every stylesheet.
  - Updates of the markup still apply while it is hidden, so it is current when it shows. A changed inline style or text is kept for when it shows, and new nodes at the top level are hidden too.
  - Effects and `$client` callbacks of the body run their cleanups when it hides, and wait while it is hidden. When it shows, the ones that ran before or that would have run run once with the current values. `<window>` and `<document>` listeners in the body do not run while it is hidden.
  - Nothing goes to the server when a body hides or shows.
  - The portals of the body are hidden with it, so a dialog of a hidden tab does not stay on the page.
  - `#defer` is reserved for a block that renders on the server later, so the name stays free.

- Hosts are Nitro's: its presets build the app for Node, Bun, Deno, Cloudflare, Vercel and the rest, so brumate has no adapters of its own. Features that need the host, such as a cache store or WebSocket, use Nitro's storage layer and its WebSocket support, and a plain handler for an app that writes its own server.

## Open

- **Reusable logic.** Done as `.brm.ts` modules, compiled with the same rules as components. See [Reactive logic in modules](../website/docs/reactive-modules.md).
- **Performance.** Measured ideas that are not done yet are in [Performance notes](./performance.md).

## Next steps

1. Write the grammar and the intermediate representation. Done in [Grammar](./grammar.md) and [Intermediate representation](./ir.md).
2. Build the parser and the analyzer, and test them on the graph output without a browser. Done in [`packages/brumate`](../packages/brumate).
3. Write the server codegen with markers and state. Done. See [Page format](../website/docs/page-format.md).
4. Write the client codegen and the loader. Measure the bytes for a counter and a todo list. Done. See [Compiler](./compiler.md#size).
5. Split client modules per handler and per update. Done. See [Code splitting](./compiler.md#code-splitting).
6. Render components on the client, inside blocks that change. Done. See [Render modules](./compiler.md#render-modules).
7. Add a Vite plugin that serves the modules and answers server function calls. Done. See [Vite](../website/docs/reference-plugin.md).
8. Add component summaries. Done as a project analysis in the Vite plugin. See [Props across files](./compiler.md#props-across-files).
