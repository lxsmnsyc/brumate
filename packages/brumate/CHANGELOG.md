# brumate

## 0.4.0

### Minor Changes

- fdc0e73: `brumate check [--json] [--no-types] [paths]` compiles every `.brm` file and runs the type checker, and prints each problem with its file, range, message, code and a link to the docs. It exits with 1 on an error. It reads `.brm.ts` modules and `'use server'` files from packages of components, such as `@brumate/ui/data.brm.ts`, the way the vite plugin does.

  Each compile error has a stable code such as `BRM012`, shown at the end of its message. `ERRORS` of the error catalog holds the code and the link of each one. The docs list every code at /docs/errors.

- 2f62fba: `brumate skill [folder]` copies a skill for coding agents into `folder/brumate`, by default `.claude/skills/brumate`. It teaches the syntax of `.brm` files, state and events, and lists every compile error with its cause and fix. It tells agents to reach for a handler or `$memo` before `$effect`.
- c519c4a: Breaking: a handler of an event with more than one word is written in camel case only. `onKeydown` and `onFocusout` on an element, `<window>` or `<document>` are a compile error, and the message names the camel form (`onKeyDown`, `onFocusOut`). Events of one word, such as `onClick`, are unchanged.

  - The `attrs` object of `createForm` has `onFocusOut` in place of `onFocusout`. A form that spreads `attrs` needs no change.
  - An app that merges its own event of several words into `ElementEvents` also adds an entry to `ElementEventNames`: `interface ElementEventNames { itemaction: 'ItemAction' }` makes `onItemAction` its attribute.

- 296a8ce: `$isPassed(prop)` tells whether the caller passed a prop, also as `undefined`. `$isBound(prop)` tells whether the caller bound it with `$bind`. A component uses them to keep its own state, or to show the caller's.
- f80f134: A dynamic tag checks its attributes, `ref`, spreads and children against its tag: the attributes of an element name, or the props of a component. Its handlers are typed from the tag, so `<{tag} onClick=((event) => ...)>` types `event.currentTarget`. A component with any props is accepted as the tag, such as `<{as}>` where `as` is a `.brm` component type.

  Breaking: an unknown attribute, a wrong value, a wrong `ref` or a wrong value in a spread is now an error. A tag that can name any element or component checks the global attributes and leaves its spreads unchecked.

- c251b27: Add the types `Elements`, `ElementProps`, `Markup`, `Component` and `PropsOf` in `brumate/elements`, with the attributes of each HTML and SVG element by tag. They accept every value that the runtime accepts, such as `class` as an array or an object, `style` as an object, a binding for `value` and `checked`, and a server function for `action`.

  Breaking: the type check reads the attributes of a plain element against `ElementProps` of its tag.

  - An unknown attribute, a wrong value, a wrong value or name in a spread and a computed attribute are errors at the attribute.
  - A handler takes its event type from `ElementEvents`, so a custom event that an app merges in reaches the handler. An event name that no element fires, such as `onDoubleClick`, is a type error.
  - The children of a component are `Markup`, so a component that takes no children reports them.
  - The rest of a `$props` call leaves out the props that another call names, as it does at runtime.

- d939be1: `cancelWhen(element, type, check)` in `brumate/events` cancels a `click` or `submit` of an element before any handler runs. A `prevent` that is written after load also cancels a delegated `click` or `submit`, which the document no longer listens to passively.
- 54d4852: The browser loads the code of the components on the page when the page starts, instead of on the first event. A function of another component, such as a function prop, a function in a context or a template, then runs at once and returns its result, as on the server. Before, it returned a promise, so a child that used its result, such as a `filter`, got a promise. A build groups the client code into one bundle for each root component, and a page of `handleRoute` preloads the bundles of its views.

  Breaking: the features that loaded code early are removed.

  - The `prefetch` attribute is a compile error.
  - The loader no longer preloads handlers on hover, near the viewport or when the browser is idle, and the `preload` option of the plugin and the loader is gone.
  - `brumate report` no longer lists what each handler loads, and `budget.event` is gone.
  - The devtools have no Loading tab. `data-prefetch="none"` on a link still turns off the prefetch of its page for navigation.

- b4faafb: Breaking: `#loading (expr) { ... }` is a compile error (BRM181). The header had no effect: the server output had no boundary and no fallback.
- 54d4852: Breaking: a memo that throws, or whose promise rejects, holds its error, and each read of it throws into the nearest `#try` around the reader. Before, the error went to the `#try` around the memo, and a rejected memo kept its old value.

  - A memo that failed on the server holds its error in the browser after resume. A handler, an effect or a binding that reads it throws to the nearest `#try`, and no longer reads `undefined`.
  - A memo that throws on the server renders the `#catch` of the nearest `#try` that reads it, also when the memo is declared outside the `#try`. An awaited memo still throws at its declaration.
  - In development the browser gets the error with its name, message, own properties and `cause`. In production it gets the message of a `ServerError`, or "The page could not compute a value". A stack is never sent.

- 043532f: Breaking: new compile error BRM185 for markup that the HTML parser closes or moves before the page runs: a block element such as `<div>` inside a `<p>`, a heading in a heading, an `<li>` in an `<li>`, an `<a>` in an `<a>`, a `<form>` in a `<form>`, a `<button>` in a `<button>`, and an element that a table does not keep. In development, the server render also throws when a component inside a `<p>` renders an element that closes the `<p>`, and names the component and the file. Production renders are unchanged.

  The "Missing end marker" error of the browser render names this cause.

- 54d4852: - `prevent(handler, ...keys)` prevents a key alone only while Ctrl, Meta and Alt are up, so the shortcuts of the browser, such as Cmd+Left, keep working on an element that prevents the arrows. A key can name a modifier that must be held, such as `'Mod+ArrowDown'` for Ctrl or Meta.
  - `prevent(handler, ...keys)` leaves alone a key that an input method gets while it composes text, such as the Enter that ends a word in Japanese.
- 54d4852: Breaking: a promise prop is a plain promise in the child. The browser no longer unwraps it into its value, and after the page resumes a streamed promise prop is a promise that settles with the streamed value or rejects with its error.

  - `await user`, `user.then(...)` and passing it on work in a handler, an effect and a `$client` callback, before and after it settles.
  - Code that read the value of a promise prop directly, such as `user.name`, reads it through `$memo(user)`.
  - An effect that reads a promise prop no longer runs again when the promise settles. `$isPending(prop)` of a promise prop is false. Use `$isPending` of a `$memo(prop)`.
  - `$memo` of a promise prop, and a memo that loads, now load in a component that the browser renders, such as a child inside `#if`. Before, its markup stayed on `[object Promise]`.

- 9b476e6: `ref` takes `$bind`: `<input ref=$bind(input)>`, also on a dynamic tag, `<{as} ref=$bind(panel)>`.

  Breaking: the bare form `ref=input` is a compile error. A `ref=$bind(x)` whose signal holds another element than the tag is a type error.

  - A component forwards a ref by declaring `ref` as a `Bindable` prop and writing `ref=$bind(ref)` on an element, so `<MyButton ref=$bind(el) />` and `<{as} ref=$bind(root)>` give the caller the element, also when `as` names a component.
  - A component that leaves `ref` in its rest props and spreads them onto an element or a dynamic tag gives the element to the parent's signal, on the server, in markup that the browser renders, and when the rest or `as` changes.
  - A `ref` bound with a setter, `ref=$bind(root, fn)`, calls `fn` with the element in the browser.
  - A signal that only the `ref` of a component binds may hold an element.

- 6405647: Children of a component behave as the body of a block, as in Svelte and Solid. Each time a component shows its children again, such as after an `#if` or a `#portal` opens again, they render with new state, and closing them runs their cleanups. Before, a click in children that a block showed a second time threw an error, and a `ref` among them could point at an element that had left the page.

  - Bodies that the browser adds to a `#for`, `#if` or `#key` in children read the contexts of the component where the children are finally inserted, also when other components pass them on, and in `#offscreen`, `#client`, `#try` and `#portal` bodies.
  - Children that a component passes on to another, as `<Select>{children}</Select>`, read the contexts of the component that inserts them.
  - Children that the browser renders again render on a page that client navigation loaded.
  - A spread onto a component keeps the children and the `as` component that the server rendered when markup updates after a change.

- 54d4852: Add `$resolve(memo, { timeout, signal })`, which waits until a memo is no longer pending and gives its value.

  Breaking: a handler, a handler prop or a `$client` callback that reads an async memo with no value yet is a compile error (BRM182) unless `$isPending` guards the read or it is written as `await $resolve(memo)`. A read the compiler cannot follow throws into the nearest `#try` with a message that points to `$resolve`, and never gives a promise or `undefined`. An effect that reads a value that is still loading skips that run, and runs again when the value arrives or fails.

- 54d4852: Breaking: the props object and the rest of `$props()` can only be destructured, read one key at a time, or spread in markup. A spread in script code, and passing them to a function, `$memo`, `$setContext`, a signal or a variable, are now a compile error, since such a copy loses the `ref` and the live props. Spread them in markup instead: `<button {...rest} class="box">`.
- 95504b2: Breaking: the attribute that scopes the styles of a component is `b-c-<hash>`, in place of `s-<hash>`. It is under the reserved `b-` prefix, so markup and data from outside the app cannot write it. CSS that names the old attribute, such as `[s-1abc]`, needs the new name.
- 67a64f7: `mount` and `visit` of `brumate/testing` install an IntersectionObserver that reports each observed element as visible, so `$client`, `#client` and `#defer` with `'visible'` run in a test. The `offscreen` option keeps elements out of view until `reveal(selector)` brings them in. `'idle'` fires on a timer after the page starts.
- 54d4852: Breaking: a handler is one update pass. Bindings run when the handler returns, and memo and binding errors go to the nearest `#try` in place of the handler that wrote.

  - Its writes compute a memo when the handler reads it. The bindings, such as the DOM text or an effect that reads two signals, run once when the handler returns. A state between two writes no longer shows or throws.
  - `flush()` from `brumate/signals` runs the waiting bindings at once, for a handler that must focus or measure what it rendered.
  - A write runs each memo it reaches once, after the memos it reads, and then each binding once. The updates of a component run before those of the components inside it, so a child gets every new prop and context value before its memos compute.
  - An error of a memo or a binding no longer stops the handler that wrote. It goes to the nearest `#try` around the code that threw. A write that has not settled after 10000 rounds, such as a loop through `ref=$bind`, stops with an error.
  - A handler waits for the update code of its own component only, not for the code of the components above it, and a failed chunk goes to the nearest `#try`.
  - Calls of the functions of other components, such as function props and provided functions, start in the order that they were made. The code of each still loads in parallel.

- 39f4baf: A `#for` takes `window(height, count)`, which renders only the items in view. The server renders the first items, with spacers for the height of the rest, and the browser renders the items that come into view as the user scrolls. Items that leave the view keep their state while they are in the list. A windowed list keeps its `#else` body for an empty list only, and takes the element that can scroll vertically as its scroller.
- 3b451bb: The dev server has a workbench at `/__brumate/workbench`. It lists the components that depend only on their props and their own state, renders each one on the server with controls for its props, and resumes it in the browser. A component that calls the server, or reads the request or the route, is listed apart, with the reason.

### Patch Changes

- 859f9b9: A prop bound with `$bind(signal, fn)` reads the value that the caller keeps right after a component writes it, in the same turn. Before, the read gave the old value until the caller drew. The setter runs at once when its code has loaded.
- 14ced48: The type check reports a prop that a component does not take, such as `<Badge tone="red" />` when Badge has no `tone`. It reads the props of every `$props<T>()` call of a component, so a bindable prop from a second call is known to its callers.
- 54d4852: The browser no longer throws `ReferenceError` for names that client code did not import.

  - A helper that a component imports in `<script module>` and that its functions call, such as `sameKeys` in ToggleButtonGroup.
  - A component named only in a template, as `as=Link`, `icon=Star` or `as=(open ? A : B)`, or used in a `#template` declared inside a block.
  - A function that a page uses in its own markup and again in children or a `#template`, also as a prop of a component there, and a wrapper such as `prevent` in a handler prop of such a component.
  - Components that only import each other, such as a Tree and a Leaf that render each other, get client code. Before, their handlers did nothing.
  - An `#else if` whose condition never changes, such as a `$isPassed` const, works after a condition before it changes.

- 54d4852: - A page that client navigation loads keeps its bindings and the handlers of its spreads. Before, a `$bind` or a handler passed through a spread wrote to the wrong scope.
  - Client navigation no longer removes the attributes that a script set on `<html>`, such as a saved `data-theme`.
- 54d4852: A component that a page gives to a dynamic tag or to the `as` of a part, such as `<Tab as=Target>` or `<{as} label=(label) />`, behaves as a component written by name.

  - The props that change reach it, also when a part passes `as` on to another part (`<Button {as}>`), when the page writes `as=(flag ? A : B)`, with a live spread or a computed attribute, and when the component names the prop in place of spreading the rest. Before, it kept the props of the server render.
  - It keeps the handlers of its caller and of its spreads when the browser renders it. Several handlers of one event all run, in that order.
  - A `class` of a spread adds to the class of the tag, such as `<{as ?? 'button'} class="part" {...rest}>`.
  - A live style variable of a part updates on it.
  - A component that a prop gets as a value, such as `as=Link`, renders in a block or a new `#for` item that the browser renders. The sender must import the component from a `.brm` file.

- 54d4852: - A provided value can hold functions in objects and lists inside it, such as `$setContext(Ctx, { slots: { increment: { onPress } } })` or `{ items: [{ run }] }`.
  - A component can import a name that is its own name, such as `ButtonContext` in `button-context.brm`.
  - A component that reads a context and provides the same context again updates when the value above it changes, and so do the components that read its value. `$getContext` always reads from the scopes above the reader.
  - A module function that returns one local under two keys, such as `{ up, cancel: up }`, is a compile error that says so.
- 393688f: An effect no longer runs again when a value that only its cleanup reads changes, as in Svelte and Solid.
- 54d4852: - An error inside a streamed `#loading` body renders the nearest `#catch`, in the body, around the block or in a parent component. The real error shows in development and a generic one in production. A reader without scripts gets the `#catch` in place. After a client navigation, a `#loading` body that never arrives because the stream ended fires `brumate:error`, and its fallback stays.
  - In production, a `#catch` no longer sends server error details to every visitor. It gets a plain `Error` with the message of a `ServerError`, or a generic message. The real error is logged on the server.
  - An error of code that fails to load no longer leaves an unhandled promise rejection.
- 54d4852: The browser renders most markup by cloning a `<template>`, not by parsing HTML. This holds for bodies of `#if`, `#for`, `#switch`, `#repeat`, `#head` and `#portal`, children of a component, dynamic tags, spreads, attributes with text and code, and child components. In the rows benchmark, creating 1,000 rows takes 5.3 ms of script, down from 8.0 ms, and replacing them 11.4 ms, down from 15.1 ms. New items of a list go in the page with less work and less garbage.
- 54d4852: A field that the user changed before the code loaded keeps its value. When the core starts, it writes the signal of each text field, textarea, select and box with a `value` or `checked` binding whose value differs from the one the server rendered, as an `input` event would. Markup that resumes after a write, or a spread that changes first, no longer puts back the value of the server.
- 54d4852: - A function that the markup calls on the server can read a memo that nothing else reads. It threw `ReferenceError` when that memo read another memo.
  - A state record of a streamed memo that arrives after the memo loaded again in the browser no longer replaces the value of the newer load.
  - A memo of an object with a shorthand property that reads another memo, such as `$memo({ id, value })`, compiles on the server.
- 54d4852: - A block that removes a component removes the component's scopes too. Its effects run their cleanups, and the content of its `#portal` blocks leaves the page.
  - A `$client` callback no longer runs after the block or the page that held it was removed.
  - A loader that stopped no longer starts handlers or `$client` callbacks from markup that the core inserts later.
  - A `$client(fn, 'visible')` without `ref` waits for the first element after it, even when another `$client` comes first.
- 3cd7155: A spread no longer writes `b-` attributes from data, such as an object from a CMS with a `b-on` or `b-b` key. Those named handlers and scopes of the page. Brumate's own `b-` attributes of a dynamic tag still pass on.
- 88b9ac7: A shorthand of a handler, such as `<button {onClick}>`, is a handler, the same as `onClick=onClick`, as in Svelte. Before, it was a plain attribute, and the element got no handler. The type check also reads a shorthand prop of a component, such as `<Feed {page} />`.
- 54d4852: The client build leaves out the code of the core that no component uses: children that the browser renders, `#template` values that it calls, `<title>` in markup, `$bind` passed to other components, markup that comes after the page (`#loading`, `#defer`, streaming lists and client navigation), `$client` callbacks, handlers of the window or the document, and forms of an `$action`. The core of the todos benchmark goes from 9.2 kB to 8.3 kB gzip. An app that compiles components in the browser sets `features: 'all'` in the plugin options.
- 54d4852: - An element with several spreads keeps the attributes of each when one of them changes in the browser, such as the `class` of a rest prop, and the attributes that other code set on it, such as an `aria-controls` that a `$client` callback added.
  - An element with a `class` that changes and a spread with a `class` keeps the class of the spread when its own class changes.
  - A spread whose handlers change gives the element its new handlers and their wrappers.
  - A rest prop updates in the browser when the parent passes a new value of a prop that it holds.
  - A rest prop leaves out the props that another `$props()` call of the component names, such as `open` in `const { label, ...rest } = $props(); let { open } = $props();`.
  - A prop of `let` that the component writes updates its markup when every parent passes a constant, such as `<Menu open=(true) />`.
  - A component with a `<style>` that uses `${}` values removes the `style` that a spread drops, also on the first update in the browser.
  - A dynamic tag keeps the element that the server rendered when its scope updates after the page resumed.
  - A computed attribute (`[name]=(value)`) whose name or value can change on a plain element or a dynamic tag no longer fails to compile with "This attribute cannot change on the client yet".
  - A memo of an object literal, such as `$memo({ title })`, compiles in the browser.
- 54d4852: An untyped `#template` parameter takes its type from the prop it is passed to. With `<ListBox items=(animals) item=row>` and `#template row(a)`, `a` is an `Animal`, so `a.nope` is an error at its place in the file. Hover, go to definition, references and rename on the template name still work. The TypeScript server plugin drops a diagnostic that repeats another at the same place, as the error of a template used twice does.
- 54d4852: - A `#template` that a component calls again at the same place with new arguments, such as for an item of a list whose object changes, updates its markup in place, as a snippet of Svelte does, and keeps focus.
  - A template at an insert updates in place only when it is the same template that the server rendered there. A template shown again after other content, and a switch between two templates of one component, render the right one.
  - A `#template` that a component gets as a prop works with components inside it. The components read the contexts that the component provides, on the server and in the browser.
  - Markup that streams in after a write, such as a `#loading` body, keeps the templates that it renders.
- 54d4852: - The Vite plugin reads and compiles the components 32 at a time. A project with hundreds of components no longer fails a build with `EMFILE: too many open files`.
  - Vitest no longer keeps `.brm` files in its file cache, so a cached component no longer calls a function of an old version of a module.
  - The highlighter marks `#reveal` and `#defer` as blocks.

## 0.3.0

### Minor Changes

- 73fb78a: `true` and `false` render as words for attributes that say their state in their value: `aria-*` and `data-*`, `contenteditable`, `draggable`, `spellcheck` and `writingsuggestions` say `"true"` or `"false"`, `translate` says `"yes"` or `"no"`, and `autocomplete` and `autocorrect` say `"on"` or `"off"`. Before, `false` removed them and `true` left them empty, so `aria-hidden=true` did not hide anything. Other attributes, such as `disabled`, are still there for `true` and left out for `false`, and `null` and `undefined` still leave any attribute out.
- 7ede95e: Components can write their props, and parents can bind them.

  - `let { open = false } = $props()` declares props that the component writes. Without a binding, the component writes its own copy, and a new value from the parent replaces it.
  - `$bind(name)` from `brumate/signals`, as the value of a prop, passes a signal or a `let` prop to a child. The child's writes change it, through any number of levels.
  - `value=$bind(draft)` and `checked=$bind(done)` on an input, a select or a textarea write the signal as the user types, without loading code of the component.
  - `$bind(name, fn)` calls `fn(next)` for each write in place of writing the name, so the parent can refuse a value or change it.
  - A rest prop keeps its bindings, and a spread on an element binds `value` and `checked` from them.
  - `Bindable<T>` marks a prop that a parent can bind. `$props<T>()` gives it as `T`. `brumate-tsc` reports a binding of a prop that is not `Bindable`, and the compiler warns about a `Bindable` prop that the component reads only with `const`.

- 397f442: Pages and data can be cached across requests, without one user's data reaching another.

  - A route exports `cache` from its module script, such as `export const cache = { maxAge: 60, staleWhileRevalidate: 600 }`, and the server sends `cache-control` for the page. A layout's `cache` applies to the pages below it.
  - A page is public only when the request did not read cookies or the `authorization` header and set no cookie, in middleware too. Otherwise it gets `private, no-cache`. A page with `cache` renders in full before its headers go out.
  - `cached(fn, { maxAge, tags })` from `brumate/server` keeps the results of a function by its arguments. The function runs without the request, so `getEvent()` throws in it. A `'use server'` file can export a function that `cached` makes.
  - The server keeps public pages too, and answers the next request for the same URL from them until `max-age` ends. Middleware still runs for each request. Pass `pageCache: false` to `handle` to turn it off.
  - `revalidate(...tags)` drops the results and the pages that used a tag.
  - Results and pages live in memory by default. `setCacheStore(storageStore(storage))` keeps them in an unstorage storage, such as Redis through Nitro's `useStorage()`.

- f62c5c3: A spread on a component can change in the browser, such as `<Button {...rest} />` with props that a parent changes. A key that the spread no longer has becomes undefined, and a prop after the spread wins over it. A binding in the spread passes on to the component.
- 397f442: The devtools show much more of what a page does, and errors show there in place of Vite's overlay.

  - **Errors** lists errors of the server, of Vite and of the browser, including handlers that no `#try` catches. The selected error shows its file highlighted, with the place marked, and its stack, whose browser frames map to their files and lines. `errorPage` opens the devtools on the error.
  - **Elements** shows a picked element with its place in the `.brm` file, its handlers and the values that its updates read. A card follows the pointer while picking.
  - **Loading** lists each part of client code that loaded, with why, how long it took and its size, and marks preloads that nothing used.
  - **Page state** lists each value that the page sent, with about how many bytes it takes and the code of the browser that reads it.
  - **Effects** counts the runs and cleanups of each `$effect` and `$client` callback, and marks one that runs too often.
  - **Timeline** shows each handler with its server calls and updates, and **Server** shows what the dev server did for the page: its render, its memos, its calls and its `#loading` bodies.
  - **Navigation** shows the routes that each client navigation kept and replaced.
  - **Blocks** lists the `#loading`, `#defer` and `#client` blocks, fires a trigger now, and shows the fallback of a body again.
  - The page can outline the elements that change. The button shows the logo of brumate and the number of errors.
  - `brumate/highlight` exports the twinkleplop language of `.brm` files.

- 397f442: Progressive forms with `createForm` from `brumate/forms`. A form works without scripts, and with them it validates and changes its lists in the browser.

  - `createForm(fn, schema, { defaultValue })` gives the attributes of a form and its fields: names, IDs, the posted values, errors with their ARIA attributes, and buttons that add, remove and move the items of a list.
  - `parseSubmission(schema, form)` from `brumate/server` reads such a form, applies the button that changed a list, validates, and builds the reply with `reply()`. `parseForm` reads indexes in brackets, so `items[0].name` makes a list.
  - With scripts, the form validates in the browser with the schema, which loads with the first focus out or input. A field shows its errors once the user leaves it, and every field does after a submit.
  - With scripts, the buttons of a list change it in the browser at once, and the items that stay keep their elements and what was typed in them. The buttons prevent the post even before their code loads.
  - A package can export a `.brm.ts` module under a name without the extension, such as `@acme/ui/forms`.
  - Code of a module function that the compiler copies into a component keeps the imports that it needs in the browser parts.

- f20217c: `gather(stream, { key })` from `brumate/stream` gives the list of a stream's values so far, so a memo of it renders a list that grows with `#for`, such as the tokens of a reply. A value with a key that came before updates its item. The server renders the empty list without starting the stream, and the list fills in the browser.
- 32f9996: `idempotent(fn)` from `brumate/server` makes a server function of a `'use server'` file run once for each form that the server renders for it. A second post of the same form, such as a double click or a post again after a reload, gets the result or the redirect of the first. With scripts, the form gets a new key after each answer. A form's `action` can now also be a server function that the component imports from a `'use server'` file.
- 0aaf002: `handle(request, { shell })` takes the HTML that the build prerendered for the path. The server sends it at once, then renders the `#defer` blocks with the `load` or `idle` trigger and streams their bodies in the same response, so the browser makes no request for each. A server that serves prerendered files passes the file as `shell` instead of sending it.
- 63d070d: `#reveal ('sequential', collapsed) { … }` shows the `#loading` bodies inside it in an order while the page streams: `'sequential'` in the order of the markup, `'backwards'` from the last, `'together'` at once, or `'natural'` as they are ready. `collapsed` shows only the fallback of the next body to show. The data still loads at once, and the server does the ordering, so it needs no code in the browser.
- de590c9: `$handler(fn, ...args)` from `brumate/signals` marks a function that a script makes as an event handler, so a spread passes it on, as it passes on a handler that a caller writes in markup. Its arguments are JSON values that go with it, and it runs as `fn(...args, event)`, such as `onClick: $handler(prevent(removeAt), index)` in a function that makes the attributes of a button. A module function can call it too.

  Spreads in markup that the browser renders, such as a new item of a `#for`, now pass on their handlers, with the modifiers of their wrappers. Before, they kept only the attributes.

- 1b378a4: A serial entry, `src/serial.ts` or the `serial` option of the plugin, lets the page state, server function calls and `cached` results hold classes of the app. It exports `plugins` made with `definePlugin` from `brumate/serial`, which turn a value into data and back, and can set `depthLimit` and `disabledFeatures` of the serializer. The server and the browser load it, the compiler lets a signal hold a class that it tests with `instanceof`, and `SendableValues` tells the type checker about the class.
- 8786dba: `transition(handler, ...types)` from `brumate/events` runs a handler inside a view transition, so the browser animates the change, such as an element that `#if` removes or a list that changes order. The transition waits for the update code of the first write. Without view transitions, or with `prefers-reduced-motion`, the handler runs as it is.

### Patch Changes

- 397f442: A route that does not compile breaks only its own pages in development, and the other pages of the dev server still render.
- ddcd3c3: A field keeps what the user typed or checked while the value of its `value` or `checked` stays the same, such as the posted values of a form that validation reads again. Before, each update wrote the value back over the user's change.
- af923d7: The first click on a page shows its result a frame or two sooner. The core takes the modules and parts that the loader preloaded instead of importing them again, and the loader preloads the serial entry and the updates of a component with its handlers.
- 7b6e85f: `:global(h1, h2)` with a list now applies to every item of the list. Before, only the first one, such as `h1`, got the rule.
- 43ac335: The first click on a page with a long list from the server runs faster. The bound elements of the page are indexed with its markers, so each update finds its element without a search of the page, and each handler of a list preloads once instead of once for each row.
- 50503a9: Lists update with less work in the browser. Rows that the client renders no longer run their updates again after they go into the page, a list whose items all change removes the old ones at once, and the loader does not watch new rows whose code has loaded.
- 43ac8c4: Long lists update faster. Rows that the client adds find their elements without a search of the page, so creating 10,000 rows takes about 370 ms instead of 4 s. A change of order moves only the items that change places, so swapping 2 of 1,000 rows moves 2 rows instead of about 1,000.
- e707f76: Under a policy with a nonce, the `modulepreload` links of a page carry the nonce, and the page has no `Link` header, which cannot carry one. Before, a strict policy blocked them.
- f7ee96f: A memo that calls a server function of a `'use server'` file renders on the server only, unless the app passes that function to `refresh` somewhere. Before, every such memo sent its value to the browser with update code, in case a call refreshed it.
- cce5d4a: An update that writes the value an element already has leaves the element alone. A list that comes again with new objects of the same values, such as from the server after a refresh, no longer writes to the rows that did not change.

## 0.2.0

### Minor Changes

- 62da1c8: `await` says where the server waits instead of streaming. `const name = await $memo(value)` declares a memo that the page waits for where it is declared, and `await name` of a memo waits for it in the render around the read: the page, the `#loading` body around the block, or the request for a `#defer` body. A run of `await $memo` declarations, one after another, loads at the same time. In the browser the value is settled, so both are plain reads.

  A `#loading` body whose values are ready when the block renders, and that renders no component, dynamic tag, template or prop, renders in place: no fallback, no swap, and its scopes are in the page state. A page that waits for every value it loads has one state record.

  A component whose script awaits a promise rendered a broken render module. It now renders on the server only, and the browser throws a clear error when it renders the component. An `await` of a promise in markup that the browser renders or updates is a compile error.

- 9609d77: `batched(readMany, lookup, options)` from `brumate/batch` turns the calls of one moment in the browser, such as the rows of a list that renders, into one call with every key. On the server, each call reads its own key at once.

  A component that the browser renders now calls the server functions of its memos once, instead of twice: the first compute of a memo takes the promise that the render made.

- 2e3cb9c: `#client { … } #else { … }` renders the `#else` body on the server, in place of the body, until the browser renders the body. Without scripts, the fallback stays.
- 1b8c722: An error in client code goes to the nearest `#try` around the scope of the code: a handler that throws, or whose promise rejects, an effect, a `$client` callback, or a memo whose load rejects. The `#catch` body renders in the browser, with the error and `reset`. A `#try` whose body holds client code ships both bodies. Without a `#try`, the page gets a `brumate:error` event on `window`, with the error and the scope, and the error is logged. `onError` of the loader receives every error first.
- e1d482b: A `$client` callback with the `'visible'` trigger that reads an element of its markup through `ref` now runs when that element comes into view, instead of the first element of the component. The code of a chart low on the page loads when the chart is in view.
- 390b5c3: `#defer (trigger) { … } #else { … }` renders its body on the server in a later request. The page has the `#else` body until the trigger fires. The browser then asks the server for the body, which replaces the fallback. The request goes to the URL of the page, so middleware and cookies apply as they do for the page.
- 3a10276: Pages hint the modules that every page loads, the loader and the core: `<link rel="modulepreload">` in the head, and `Link` headers that hosts can turn into `103 Early Hints`. `earlyHints` in the options of `route` receives the links before the page renders, for a server that sends `103` itself, such as with Node's `writeEarlyHints`. The client build writes the URLs to `.brumate/hints.json`.
- b72f505: `defineEnv` from `brumate/env` declares the environment variables of the app in `src/env.ts`, with a Standard Schema for each, split into server and public values. The server checks them when it starts, and fails with every missing or wrong one. The browser gets the file without the server schemas, with the values of the public variables written in. Only components import the file in code that the browser loads. The compiler reports a read of a server variable in code that runs in the browser, and a value made from one that the page state would send. The server refuses to send a page whose state holds the value of a server variable, and the error at start does not print one. The `env` option of the plugin names another file, or `false` uses none.
- 56e1e1d: `budget.event` fails the client build when the first run of one handler loads more than a size, and `budget.component` when one component ships more. The error names the component, the handler and its largest imports. `report: true` lists the largest handlers.
- 5c1f02c: For readers that run no scripts, the server renders `#loading` and `#defer` bodies in place, in the order of the page, with no `<template>` and no swap. The page arrives later, complete, with the same state. `inOrder` in the options of `handle`, `render` and `renderToStream` decides: `'bots'`, the default, for requests whose `User-Agent` is a known crawler, `true`, `false`, or a function of the request.

  `getEvent().signal` aborts when the request's signal does, or when the reader of the response goes away, for pages, server function calls and `#defer` requests. A page that the reader left sends no more `#loading` bodies.

- 5eabd62: The children of a component render where the component inserts them, so they read the contexts that the component provides. A part passed into a component, such as a `Label` inside a `Select`, now reads the context of the `Select`, on the server and in the browser.
- 37ddbf6: `src/middleware.ts` runs for every request of the app, before the `_middleware.ts` of the folders: pages, endpoints, server function calls, form posts and the requests for `#defer` bodies. Its default export, written with `defineMiddleware`, takes the `RequestEvent` and `next`. `event.kind` says what the request is for, and `event.call` has the server function of a call and its arguments. A `'use server'` file can export `middleware` for its own functions. The `middleware` option of the plugin names another file, or `false` runs none.

  Middleware hands values to the rest of the request through `event.locals`, typed by the `Locals` interface of `brumate/server`, which an app adds fields to. `event.waitUntil(promise)` keeps work going after the response ends, through the `waitUntil` option of `handle` on hosts that have one.

- d0bc8df: `navigate(href, { replace, scroll })` from `brumate/routes` loads a page as a link does, and returns when it shows. `$route()` gives the URL, the query string and the params of the route, typed from the route files, on the server and in the browser, and updates when navigation changes it. `$navigation()` gives the navigation that loads, `{ pending, from, to }`. The loader sets `data-navigating` on `<html>` while a page loads. After a navigation, it announces the new page to screen readers in a live region, and moves the focus to the first `<h1>` of the new content, or to `<main>`, except when only the query string changes. `navigate: { focus: false }` in the plugin keeps the focus.
- c794d01: `brumate/events` wraps event handlers with what must happen before their code loads: `prevent(handler, ...keys)`, `stop(handler)`, `once(handler)` and `capture(handler)`. The compiler reads the wrappers in markup, so the loader applies them on the first event. On a keyboard event, `prevent` can name the keys to prevent, such as `onKeyDown=(prevent(move, 'ArrowDown', 'Enter'))`, and TypeScript checks the names. A modifier after the event name, such as `onSubmit:prevent`, still works, with a warning that points to the wrapper. A modifier on a component is now a compile error, since nothing applied it.
- 49c7a0f: `rateLimit({ max, window, key? })` from `brumate/server` limits how often a client can call a server function. Called first thing in the function, it counts the calls of each key in a sliding window and rejects the ones over the limit with a `RateLimitError`: status 429, `Retry-After`, and `retryAfter` in the browser. The key is the app's, such as the email of a sign-in or the ID of a user, from the event and the arguments, or else the address of the client. Each call counts with one atomic increment before the limit decides, so calls at the same time cannot all pass. `rateLimit.middleware(options)` limits every request under a folder of routes, or of the app from the entry middleware, and counts each route by its pattern, which `event.route` gives. `rateLimit.strict` is a preset for sign-ins. The counts live in memory, or in a store with an atomic increment, such as Redis, through `configureRateLimit({ store })`. `clientAddress(event)` reads the address of the client from the server, which passes it to `handle` as `address`, or from `X-Forwarded-For` when that address is one of the proxies that `configureRateLimit({ proxies })` names. A malformed range throws. Without a key or an address, a limit throws in production and warns in development. Limits count unless turned off, and never while the build prerenders.
- 633273b: The page state and server function calls send the web values of `seroval-plugins`: `Headers`, `FormData`, `Request`, `Response`, `ReadableStream`, `AbortSignal`, `Event`, `CustomEvent` and `DOMException`, next to `URL` and `URLSearchParams`, whose plugins replace brumate's own. A `ReadableStream` streams its chunks as they are ready. An `AbortSignal` goes as it is when sent, with whether it aborted and its reason. `Blob` and `File` still go only in the arguments of a call, as parts of multipart form data, and now from anywhere in them, such as a `Map`, a `Set` or a `FormData`.

  The sync paths of the page state and of shared calls no longer take an async iterable as an empty stream: the page state streams it, and a call with one in its arguments is not shared with another.

- 8890c2f: Skew protection. Each build has an ID, which the client build writes to `.brumate/build.json` and the server build reads, or `BRUMATE_BUILD` in the environment names for both. The page state carries it, and the browser sends it with each server function call and each request for a `#defer` body. A call from a page of another build to a function that is gone answers 409, and the browser loads the next page in full and posts a form of `$action` again without scripts. Forms carry the ID as `__build` in their URL, and a post without scripts from another build to a function that is gone answers 303 to its page. When the code of a handler fails to load and the server is of another build, the page loads again. Client navigation loads a page of another build in full. A page loads again, or in full, once for each build in a tab. The page gets a `brumate:skew` event first. `skew: { keep }` in the plugin keeps the files of earlier builds in the client output.
- ced8c27: A handler that a component passes on with a spread, such as `onClick` in `{...rest}`, now reaches the element, with its wrappers of `brumate/events`, and runs in the component that passed it. An update of a spread in the browser removes the attributes that the new value drops.
- c0e834d: A `#template` passed as a prop renders in the browser, such as a list item whose selection changes. It used to fail the render. The template keeps reading the values of the component that wrote it.
- a17d60b: `visit(path)` from `virtual:brumate/testing` answers a path with the routes of the app and resumes the page in the DOM of a test. Links use client navigation, and forms, server function calls and `#defer` requests go to the same routes, with the cookies that the answers set. Responses of the server now keep their `set-cookie` headers in DOM environments such as happy-dom, which drop them from the headers that a response is made with.
- 418ccb8: `$debounced(value, ms)` and `$throttled(value, ms)` from `brumate/signals` are memos that the browser writes after a wait: once the value stops changing for `ms`, or at most once every `ms`. On the server, both are the value itself. The memo is pending while it waits, so `$isPending` is true.
- a15e5d4: A `<title>` in `#head` sets the title of the page. The last one in the page wins, so a title in an `#if` needs no code in a script, and the title changes as blocks add and remove them. A `<title>` elsewhere in the markup is an error, except in an `<svg>` or a `<head>` element. `$title` still works, with a warning that points to `<title>`, and goes in a later version.
- 7c05f82: **Upgrading from 0.1.** These changes need attention:

  - The page format changed. The scopes inside blocks and `#loading` bodies have IDs such as `4.0`, so the client of one version cannot resume a page that another version rendered. Deploy the server and the client build together. Skew protection loads such a page again in full.
  - Event handlers run as if each element had its own listener. `:capture` handlers run first, and an event that does not bubble, such as `focus`, no longer runs the handlers of the elements around its target.
  - A modifier after an event name, such as `onSubmit:prevent`, still works, with a warning. Use the wrappers of `brumate/events` instead. A modifier on a component is now a compile error.
  - `URL` and `URLSearchParams` use the plugins of `seroval-plugins` in place of brumate's own, so state that a page of 0.1 wrote does not resume with 0.2.

### Patch Changes

- 0b95cbc: The scopes inside `#if`, `#switch`, `#for`, `#repeat`, `#try` and `#offscreen` get IDs after an ID of their block, such as `4.0`, so the markup after a block keeps its IDs whatever the block rendered. A `#defer` body then loads on a page whose markup before it depends on the user, such as a prerendered page. The page format changed, so the server and the client must come from the same version.
- ef3e305: The scopes of a `#loading` body get IDs after the ID of their boundary, such as `5.0`, so the IDs of a page no longer depend on the order in which its `#loading` data arrives. `$id()` inside a `#loading` body gives an ID such as `b5_0-0`, which also works as a CSS selector. The page format changed, so the server and the client must come from the same version.
- e3c6aee: Fixes how the loader runs handlers. `:capture` handlers now run before the handlers of the elements inside. An event that does not bubble, such as `focus` or `mouseenter`, no longer runs the handlers of the elements around its target. `:prevent` on `wheel` and `touchmove` now prevents: the listener of a type is passive only while no handler of the type prevents, so `:passive` is no longer needed.
- 5baf5b7: Pages render faster on the server. A page with lists or `#if` blocks no longer pays for a lookup table of every scope ID.
- d338381: On the dev server, a change to a module that only the server reads, such as data or Markdown that a page renders, now reloads the page. Before, the page kept showing the old content until a manual reload.
- ab4d9cc: A page with no pending `#loading` body sends a smaller state script, and renders faster on the server. The script assigns only the values that it uses more than once.
- 95ce0cd: An element with a spread writes each attribute once. A later attribute wins, and a `class` of the spread adds to the `class` of the element. The element used to get two `class` attributes, and the browser kept the first.
- adad4ea: The core works on a site whose Content Security Policy has `require-trusted-types-for 'script'`. It makes a Trusted Types policy named `brumate`, once, when it first inserts markup, and passes the markup that it renders and the scripts of `#defer` bodies and of pages that the client router loads through it. Allow it with `trusted-types brumate`.

## 0.1.1

### Patch Changes

- 96c35be: The server renders memos, signals and inserts that always give a primitive, such as `$memo(count * 2)`, `let count = $signal(0)` with `count++`, or `{index + 1}`, without a memo object or a check for a promise. Inserted literals, such as `{'<b>'}`, are escaped when the component compiles.

## 0.1.0

### Minor Changes

- 246a5e1: - An app can use `.brm` components, `.brm.ts` modules and `'use server'` files from an npm package. The package opts in with a `brumate` field in its `package.json`, and the plugin of the app compiles its files.
  - The IDs of the components and server functions of a package come from the package name and the path in it, so they stay the same however the package is installed.
  - A server function of a package becomes an endpoint only when the app imports its file, directly or through the package.
  - The plugin keeps these packages out of Vite's dep optimizer and compiles them into the server build.
- afe220a: `$provide` is now `$setContext`, and `$context` is now `$getContext`. They take the same arguments as before.

  An import or a call of `$provide` or `$context` is a compile error that names the new function, such as `$provide was renamed to $setContext`.

- c530c07: First release of brumate: the compiler, the Vite plugin, the server and client runtimes, routing, type-checking for `.brm` files, and a language server with a VS Code extension.
- 4825dbb: - `#offscreen (visible) { … }` hides its body when `visible` is false and keeps it in the page, with its elements, form fields and state. A body that is hidden when the page renders is rendered in the browser the first time it shows.
  - While the body is hidden, its effects, `$client` callbacks and `<window>` and `<document>` listeners do not run, and its portals are hidden too.
  - `#defer` is reserved for a future block. Using it is a compile error.
- 0a2b5a3: Pages are smaller and render faster, and the first click needs less code. This changes the page format, so the server and the client must come from the same version.

  - The page state is written as inline scripts. Pages with a Content Security Policy must pass `nonce` to `render`. Code that read `type="brumate/state"` scripts as JSON must change.
  - The attributes that brumate writes start with `b-` instead of `data-`, such as `b-b` and `b-on`. An element attribute that starts with `b-` is now a compile error. `data-prefetch` and `data-reload` are unchanged.
  - `brumate/client` no longer exports `context`. `portal` is now `portalTo`, and `provide` is now `updateContext`.
  - The core no longer listens to the `brumate:hot`, `brumate:remount` and `brumate:refresh` events.
  - After `load`, pages preload the code of components with handlers near the viewport. Set `preload: false` to turn it off.
  - `brumate/static-loader` is the loader without client navigation. The plugin uses it with `navigate: false`.
  - `brumate/server` exports `parse`, `safeParse`, `parseForm` and `fieldErrors`, which check server function arguments with any Standard Schema library.
  - A `'use server'` function declared in `<script module>` can now be called from the browser.
  - A path with a malformed escape, such as `/%E0`, answers 404 instead of 500.

### Patch Changes

- 246a5e1: - `answerCalls()` from `virtual:brumate/testing` answers the server function calls of a component test with the real server functions, in the test process. It returns a function that restores `fetch`.
  - In a DOM test, the server version of a component (`?brumate-server`) and `virtual:brumate/server` now import the server code of `'use server'` files, not the browser stubs.
- 3e39ba2: - A link that keeps the layout no longer loads the memos of the new page again after a value changed on the page before. Before, such memos called their server functions again.
  - A redirect from a server function call or from the form of an `$action` now loads the page on the client, as a form without `$action` does, with a view transition of the type `form`. A redirect to another site, or with `navigate: false`, still loads the page in full.
  - `unmount()` of `mount` from `brumate/testing` removes the scopes of the component from the client runtime. A refresh in a later test no longer loads the memos of components that unmounted.
  - A `<window>` or `<document>` listener of markup that is gone, such as a page that client navigation replaced, no longer runs.
- f186260: - A value in a `<textarea>` or a `<title>` renders without comment markers, which became part of the text. A value that changes must be the whole content of the element, and the compiler reports one that is not. The client sets the text, and the `value` of a `<textarea>`.
  - A `#try` body that throws on the server no longer leaves anything in the page: its stylesheets are sent with the next copy of the component, and its `#portal` and `#head` markup, its title and its `#loading` bodies are left out.
  - `brumate-tsc` no longer reports TS2440 when a file imports the name that its file name gives the component, such as `SignIn` in `sign-in.brm`.
  - Prerendering writes the SHA-256 hashes of the inline scripts of each page to `.brumate/prerender.json` in the client build, for a Content Security Policy without a nonce.
- 2bb5c7f: - A `#try` body that throws while the server renders no longer leaves its scopes in the page state. The browser could update them, and fail, such as after a client navigation.
  - In development, `event.refresh(fn)` in a component's server function now refreshes a function of a `'use server'` file, as it does in production.
