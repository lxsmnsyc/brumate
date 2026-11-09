# brumate

## 0.7.0

### Minor Changes

- 7fa3213: A markup spread can hold the props object or the rest as a branch of `?:`, `&&`, `||` or `??`, such as `<div {...(open ? rest : {})}>`. The other branch is an object literal, `undefined`, `null` or `false`. When the branch is on, a `ref` in the rest reaches the element. When it is off, the rest is not on the element and the `ref` is cleared: a signal is set to `undefined`, and a setter of `$bind(name, fn)` is called with `undefined`, then with the element when the branch turns on again. A call, a nested condition or another object in the other branch is still BRM115.
- 846e25f: Breaking. A context has no default value. `createContext(key)` takes only a key, and `$getContext(Ctx)` and `$store($getContext(Ctx))` throw when no provider above the reader set the context, on the server and in the browser: `The context "key" has no provider above this component. Provide it with $setContext, or in a parent that does`. A default was one object for every request on the server, which made a context a global. `$route()` and `$navigation()` still read on every page. To migrate, delete the second argument of `createContext` and provide the value with `$setContext` in a component above the readers.

  `$getContext(Context, fallback)` reads a context that may have no provider. It gives the provided value, or the fallback when no component above provides the context. The second argument decides, so `$getContext(Field, undefined)` is the optional read, and a provided `undefined` is a value. A literal fallback is passed as it is, and other code runs only without a provider, once per read. `$route()` and `$navigation()` always have a provider. A store in a context that may be missing is read with the guard on the value, `const field = $getContext(Field, undefined); const state = field ? $store(field.state) : undefined;`, or with a store as the fallback, `$store($getContext(Locale, store('en-US')))`, which makes a store for each reader only without a provider. A `let` in the guarded form, another test or another shape is the compile error BRM197.

- ac11f29: `event.target` is the control for the events of a form control. In a handler of `input`, `change`, `beforeinput`, `focus`, `blur`, `focusin` and `focusout` on an `input`, a `select` or a `textarea`, `event.target.value` needs no cast. For other events and elements, `event.target` is an `Element`. The new type `ElementEvent<K, E>` of `brumate/elements` gives the type of the event. `<window>` and `<document>` keep `EventTarget`.
- a503508: Each node of the graph in the devtools has its place in the file. The inspect endpoint gives each node `at`, with the line and column of the name of a signal, prop or memo, or of the start of the markup, block or effect. A node from a module function also gives `file`, the module. In the Graph tab, `line N` in the side panel opens the editor there, and the tooltip names the place. The label of a markup node is the site label alone, such as `insert`, without the place.
- bee0883: `$isPending` takes several memos. `$isPending(a, b)` is true while any of them loads, and a read of each memo it names counts as guarded for BRM182 in a handler. BRM108 now reads "$isPending needs async $memos as its arguments".
- 72b1aab: MathML elements are typed. `Elements` has the MathML tags (`math`, `mi`, `mo`, `mfrac` and the rest), with `display`, `mathvariant`, `scriptlevel` and the attributes of each tag. A handler on a MathML element gets a `MathMLElement` as `currentTarget`.
- 364089d: `$gate(value, (prev, next) => boolean)` declares a memo that takes its new value only when the guard returns true. Otherwise it keeps its value and its readers do not run. `const query = $gate(input, (_, next) => next.length >= 2)` holds a search until two letters are typed, and `$gate(list.filter(done), (prev, next) => !sameItems(prev, next))` is a memo with its own equality. The first value always passes, and the server renders the value, so the browser guards from it after resume. A guard that throws makes the memo hold the error. `await` or a server function call as the value is the compile error BRM203, and any other promise or stream throws where the value is computed.
- 058e073: The element types have more HTML attributes: `meter form`, `dialog closedby`, the `shadowroot*` attributes of `template`, `style type`, the microdata attributes (`itemscope`, `itemtype`, `itemprop`, `itemid`, `itemref`) and `exportparts` on every element, and `xlink:href` and `xml:lang` on SVG elements. Some values now complete their known names and still accept any other string: `link as`, `script type`, `meta http-equiv`, the `iframe sandbox` tokens, the `autocomplete` tokens of `input`, `textarea` and `select`, the `button command` values, and `blocking`.
- 84fd338: `brumate skill` also copies the skills of the installed `@brumate/*` packages, such as `brumate-ui` from `@brumate/ui`, so one command installs every skill that matches your versions.
- c74bba5: Breaking. Every context is static: a `$setContext` value is read once, and a reader keeps it. The compiler no longer updates a context when a name in its value changes, and the runtime has no `updateContext`. A value that changes goes in a store: `$toStore` in the provider, `$store` in the reader. `$route()` and `$navigation()` still update their readers.

  A `$setContext` value that reads a signal, a memo, a prop or a `$bind` value that changes in the browser, outside a function, is now the compile error BRM196. It was a warning, and only for a local signal, memo or `let`. A read inside a function, `$untrack` and `$toStore` are allowed. A handler that a reader gets from a context keeps the scope of its provider, so it still works after that scope goes. To migrate, replace `$setContext(Ctx, { value })` with `$setContext(Ctx, { value: $toStore(value) })` and read it with `const given = $getContext(Ctx); const value = $store(given.value);`.

- ffd26e0: `bridge()` of `brumate/store` makes a store from a store of another library, such as zustand, so it can cross the page state in a context or a prop. Give it `create(snapshot)`, `get(source)`, `subscribe(source, listener)` and an optional `set(source, value)`, and keep its value in a module-level export of a script file or of `<script module>`. The page sends the data from `get` and the name of the bridge; the browser runs `create(snapshot)` once, at the first subscriber, and every reader and prop holder shares that store. `.source` is the library's store and is `undefined` in the browser until the store has a subscriber. Resume never calls `set`. A `bridge` value that is not a module-level export, such as one in the script of a component, is a compile error (BRM200), and `brumate check` reports it. When `get` gives data that cannot be sent, the server render throws an error that names the store and the context or prop. The error for a store of another library in a prop or a script value now points to `bridge()`.
- 050e7fe: Add `$store` and `$toStore`, and `brumate/store`. `$store(source)` binds any store, a value with `get`, `subscribe` and optionally `set`, to a variable, and `let x = $store(source)` writes the store with `set` when the variable is assigned. The source is any expression that gives a store: a key of a `$getContext` value, `$getContext` of a context that holds the store, an import, a prop, a value of `<script module>`, a call, or a store made there, as `$store(store(0))`. `$store` is typed `$store<T>(source: StoreLike<T>): T`. `$toStore(value)` makes the store of a memo, a signal or a prop in a `$setContext` value. `Store` calls its listeners only when the value changes.

  A context, `undefined`, `null` and `$store(field?.state)` as the source are compile errors that name the fix (BRM199 and BRM197). A source that awaits or calls a server function is BRM198. A source that gives no store when the page renders throws a `TypeError` that names `$store`, and a store of another library in a prop or a script value that `$store` reads makes the server render throw an error that names the component and the value. On resume the browser runs a source that is not a context once, with the values the page resumed. It subscribes, and writes the variable once if the store's value differs from the server's. It never calls `set`. A store that the source makes starts from its first value in the browser.

## 0.6.2

### Patch Changes

- 349ade9: The Blocks tab of the devtools shows a `#defer` block as failed when its request ends without a body, such as a 404 or a network error. It stayed "loading" before.
- 43d096c: A component can pass a function that it imports from a module as a prop, as it can a function that it declares. The build failed before with "holds a Function, which cannot be sent to the browser". An imported value that is not a function, such as a list, still goes to the browser in the page state.

## 0.6.1

### Patch Changes

- c9f505b: Three fixes that make the browser render match the server render. A ref setter (`$bind(signal, fn)`) called after the render now calls the exported function of its component, not a copy of the render that wrote stale values. A memo that rejects inside a `#try` with a `#catch` no longer reaches `onError`, as on the server. A `class` with conditional classes before a static class keeps the order of the server.
- d4a108d: The `#defer` body of a prerendered page that has browser code shows the request's data, such as a context, not the data of the build.
- 749e1d1: A `$memo` or `$debounced` of an object literal with `as`, `satisfies` or `!` compiles for the browser instead of failing with `PARSE_ERROR`.
- ea40983: A component that the browser renders shares its `<script module>` state with the instances that resumed. The render module imported a copy of the module script, so each copy had its own state.
- d1296f4: `<document onDOMContentLoaded>` is a compile error ([BRM201](https://brumate-docs.vercel.app/docs/errors#brm201)). The compiler lower-cased the name, so the handler listened to `domcontentloaded`, which the browser never fires, and page code loads after the HTML. The same holds for the `webkit*` animation and transition names, the `DOM*` mutation events and `DOMMouseScroll`; the error names what to write instead, such as `$client(fn, 'load')` or `onAnimationEnd`.
- 16d9787: A prerendered page keeps its query string, and `$searchParam` reads the URL when the page loads. A signal that no handler writes also follows the URL now.
- 11b1f41: A component that the browser renders runs each `$memo` once, as the server does. A memo that throws holds its error until it is read, so a `#try` around the read catches it. A `$debounced` value is not pending, and a function prop does not run again, right after the render.
- 51eb398: The browser runtime keeps the promises of the setters of `$bind(signal, setter)` until they settle, in an app that passes `$bind` to a component, so `@brumate/ui` can tell a refused write from one that a setter has not decided yet.
- 2c6662d: A `#template` of the same file that renders a component, or reads an import, now works when markup that calls it updates in the browser. The update part of the client code copied the template but did not import what it uses, so the first update threw `ReferenceError: <Component> is not defined`.
- 87700cd: An update in the browser that replaces the markup of an insert now destroys the scopes of the removed nodes. A component rendered in the browser with a `#for` that calls a `#template` of the same file made new scopes at each update and never freed them, so the page leaked memory and their cleanups never ran.
- 4dc4d6d: A `#template` of the same file that markup calls, such as `{row(item)}` in a `#for`, now updates its elements in place when the same template renders again at the same insert. Before, each update replaced them, so an `<input>` in the template lost its focus, caret and typed value. A different template, or a value that is not a template, still replaces the markup.
- 7b500e2: A `<title>` in `#head` that reads a signal or memo follows it after the client router loads a prerendered page.

## 0.6.0

### Minor Changes

- 6e1fcb3: Add `checkAccessibility(options)` to what `mount` and `visit` return. It runs axe-core on the rendered page and throws with each violation, its element and its fix. Rules about a whole page are off for a mounted component, and the landmark rules are off for a visited page while an element with `inert` or `aria-modal="true"` is in it, and rules that need layout are off. axe-core is an optional peer dependency.
- e9dd2f9: Type the ARIA attributes. Each `aria-*` attribute of WAI-ARIA 1.2 has its value type in `brumate/elements`: a boolean (`true`, `false` or the words), a tristate, an enumeration, a number or an ID list. `role` takes `AriaRole`, the roles of WAI-ARIA 1.2 and `doc-*`. `aria-${string}` still takes any other name. New exports: `AriaAttributes` and `AriaRole`.

  A caller that keeps `role` in a `string` variable has to narrow it to `AriaRole`. `String(flag)` for an ARIA boolean can become the boolean. A number for an attribute that takes text, such as `aria-label=(1)`, is now a type error; pass a string.

- 5bf701f: Event modifiers in the attribute name are removed. `onSubmit:prevent=save` is a compile error (BRM022) on elements, `<window>`, `<document>` and components, and the error names the wrapper of `brumate/events` to write: `onSubmit=(prevent(save))`. For `:passive`, write a plain handler, since listeners are passive unless a handler prevents. BRM023 is gone, since BRM022 covers components.
- e40ba94: Add `$searchParam(name, options)` to `brumate/signals`. It gives a signal bound to one parameter of the query string: the server renders the value of the URL, a write in the browser changes the URL with `replaceState` (or `pushState` with `{ history: 'push' }`) and asks the server nothing, and back and forward write the signal. `parse`, `serialize` and `default` convert the value, and `{ server: true }` asks the server for the page again.
- fcfe216: `src/middleware.ts` can export `onError(error, info)`. The server calls it, in place of `console.error`, with each error that is not a `ServerError`: a page, an endpoint, a server function call or form post, a `#defer` body, and a `#loading` body after the response started. `info` has the `event` and the `kind`, and `ServerErrorInfo` comes from `brumate/server`.
- d61aa37: Add `<style global>`: a block of rules with no scope attribute, so a stylesheet of unscoped selectors needs no `:global(…)` around each one. A plain `<style>` stays scoped and both can sit in one component. It works with `lang="scss"` and `lang="less"`. A `<style>` with an attribute other than `lang` and `global`, such as `scoped` or `media`, is now a compile error (BRM189), where it was ignored before, and so is `global` with a value (BRM190).

### Patch Changes

- 1d03636: A memo that no code reads does not run in the browser, as on the server. The browser render leaves out its declaration and its compute, and so does a memo that only such a memo reads. A memo with a side effect in its compute, such as a server function call, no longer runs there. A memo that only an `await` reads still runs and still reports its rejection to the nearest `#try`; `$$b.unreadMemo` stays for that case.

## 0.5.2

### Patch Changes

- 3023ba9: A layout that stays on a client navigation and reads `$route()` now updates in the same frame as the new page. Before, its update waited for the code of the new page to load, so the layout showed the old route for a moment. An update now waits only for the code of the components at its scope and above it.

## 0.5.1

### Patch Changes

- 1edc1f7: Fix a block that holds a body of a component the browser renders: it showed the body before the update code of a settled memo had run, so a `<textarea>` or text that reads the memo was empty until the code loaded. The hold now waits for those updates.
- e43bf63: Fix the browser render module of a component that uses another component only in a `#template` inside a block (`#try`, `#if`, `#switch`, `#for`, `#key`, `#loading`): it now imports that component, where it threw `ReferenceError`.

## 0.5.0

### Minor Changes

- db63624: `await $memo(...)` waits in the script of a component, a block body or a `#for` row that the browser renders. `await name` waits at the start of its markup. The code before an `await` runs once, and the component or body fills its place when the memo settles. The loads of awaited memos start where the server starts them, so two independent loads run at the same time. A load that fails goes to the nearest `#catch`, also when a `#try` body waits.
- cbe48a5: Outside every `#loading`, a block that the browser renders holds its new body until the memos it waits for settle, as the server holds the page. A branch of an `#if` or `#switch`, a `#key` body, a `#client` body and the fallback of a `#for` keep what they show until then, and a new row of a `#for` shows when it settles. A switch back during the wait drops the held body, and a switch to it again before it settles takes it back without a second load. It is on in a build where a component that the browser renders waits at `await $memo(...)`. With it on, the script of a new body runs before the cleanups of the old one, and its effects and `$client` callbacks after them.
- 7f07cfb: The client entry of a build no longer holds a table of every bundle of the app. The server names the bundles that a page needs, and their stylesheets, in the `b-load` attribute of its state records, for the first load, for client navigation and for `#defer` bodies. The new `brumate/bundles` module, which `virtual:brumate/manifest` re-exports, loads them. The website entry drops from 13.3 kB to 3.8 kB (gzip). A page links to the stylesheets of the bundles of its views in its head.

  `start()` no longer takes `loadBundle`, and the manifest of a build exports only `load`. In a build, `render()` names the bundles of the client build by default, so a server that calls it itself needs no new option. `brumate/server` exports `setClientBundles()`, which sets the bundles that a render names when its options pass none. The Vite plugin calls it in a server build with those of the client build, and warns when the server build finds no `.brumate/hints.json` of a client build.

- 3b62101: `#loading` shows its `#else` in markup that the browser renders, such as a branch of an `#if` that opens or a row that a `#for` adds, while a memo that its body waits for loads, then the body, as a streamed block does. A memo of a child component counts too. Later updates keep the content. `#reveal` orders such blocks, also those of the components inside it, and a body whose load fails keeps its fallback and reports the error to the nearest `#catch`.
- b4f8ec8: `#loading (posts) { … } #else { … }` names memos that the body renders from. Once the body has shown, the block shows its `#else` again while a named memo, or a memo that it reads, loads. The cause can be a write of its input, a `refresh` from a server function or a load it starts. The body stays in the page, hidden with the `#offscreen` rules, and comes back with the same elements and their state. A name that is not a memo that markup in the body reads fails to compile, with BRM186 in place of BRM181. A named memo that is or reads a `$debounced` or `$throttled` memo warns.
- 6c4cee2: A promise in markup renders the value that it settles to, in text and in attribute values, such as `<p title=getTitle()>{Promise.resolve('hello world')}</p>`. A pending promise makes the nearest `#loading` pending: the block shows its `#else` until the promise settles, the server streams the body then, and sends each element with its final attributes. Outside every `#loading`, the server waits for the promise. A spread follows the attribute rule. In the browser, the boundary counts the promise as a wait, an update keeps what shows until the new promise settles, the latest promise wins, and a rejection goes to the nearest `#catch`. A `#loading` body whose text or attributes call code now always streams from the server, since the call can give a promise. A promise that the compiler sees in an event handler, the key of a `#for`, `ref` or `$bind` is a compile error, BRM188.

### Patch Changes

- 87ddc16: On the server, each `const x = await $memo(...)` starts its load as soon as the values it reads are ready, not where its run of awaits starts. A load moves up to right after the last statement that declares a name it reads or can change one, such as `q = x`, `params.set()` or a call of a local function, so two independent awaits with a statement between them load at the same time. Each `await` still waits where it is written, the statements between run once and in their order, and an error of the load or a throw of its expression comes where the `await` is. `$effect`, `$client`, imports and types no longer end a run of awaits.
- db63624: The client of a build is smaller:

  - It drops five more runtime paths when no component uses them: `#try`, the fields of an element `$bind`, windowed lists, dynamic tags and `$route` or `$navigation`. The Vite plugin sets a flag for each from the compiled components, as it does for the other features. The client of a page like the todos example is about 1 kB smaller (gzip). A build with `features: 'all'` is unchanged.
  - The code-part loading that lazy loading left is gone. A handler or an update no longer waits for a part of its module, and a build no longer emits the `w` export. Effects now also wait for writes that wait for code, so an effect such as the check of Tabs never sees a half updated page.

## 0.4.4

### Patch Changes

- 3ee4318: When two errors of one `#try` body arrive at the same time in the browser, such as two effects that throw in one update or two rows of a `#for` that fail at once, the `#try` now renders its `#catch` once and shows the first error, as the server does. Before, it rendered the `#catch` once per error and the last error stayed. `onError` still receives every error.
- 2c186c1: An effect or an update that writes a value it reads no longer hangs the tab. After 1000 rounds of effects in one change, or 10000 rounds of updates as before, the page stops the loop and sends an error to the nearest `#try`, or to `onError` and the `brumate:error` event when no `#try` is around it. The message names the effect or update and its component, points to `$untrack`, and has the code BRM187.

## 0.4.3

### Patch Changes

- c49e393: In a browser render, a memo with `await` inside now shows its value once it settles, even when its expression gives a string or an array, as in ``$memo(`Hi ${(await load()).name}`)``. Before, the text and attributes that read it stayed empty. Its rejection now goes to the nearest `#catch`, or to the page once when no `#try` catches it, also when nothing reads the memo.
- f2e4e84: Keep the metadata of files and blobs sent to server functions. A blob arrives as a `Blob` instead of a `File` named `blob`, an empty type stays empty instead of `application/octet-stream`, and a file keeps its exact name and its `lastModified`. The server still reads calls from pages that send only the part index.

## 0.4.2

### Patch Changes

- 955d3d9: In a browser render, an `#if`, `#switch` or `#for` header, a component prop, or a function in markup that reads an async `$memo` whose input never changes now waits for the memo to settle. Before, it read the promise: an `#if (user.admin)` showed its `#else` body and kept it. The block, the component or the value now renders once the memo settles, and a rejection goes to the nearest `#catch`, reported once. A child component that gets such a memo as a prop now gets the settled value, not the promise, as in a server render. A prop whose value is a function, such as `format=(() => user.name)`, does not hold the component back. Server renders do not change.
- 00f6b65: A browser render now handles the rejection of an async memo that the script reads only with `await`, as in `await side;` or `$memo((await side).length)`. The browser compiles `await side` to a plain read of the promise, which dropped it, so the rejection was unhandled. It now goes to the nearest `#catch`, or to `onError` and the `brumate:error` event.
- 73c5b8e: In a browser render, text and attributes that read an async `$memo` whose input never changes now show the value once the promise settles. Before, they stayed empty, because nothing updates such a memo. A rejection of the memo now goes to the nearest `#try`, or to `onError` and the `brumate:error` event. Markup that the browser renders as HTML instead of a cloned template still does not wait for the memo.
- b834104: A `#try` whose body holds only a child component now catches the client errors of that child, such as a click handler that throws, an async handler that rejects or an effect that throws. Before, the error went past the `#catch` to `onError` and `brumate:error`, unless an element with a handler sat next to the child in the same `#try`. This also holds for a grandchild and for a child inside an `#if` or a `#for` in the `#try`.
- 1930832: A `#try` now catches the client errors of a `#template` by where the template is called. Before, two cases went past the `#catch` to `onError` and `brumate:error`: a template called both inside and outside the `#try`, and a template declared above the scope that holds the `#try`, such as a top-level template called in a `#try` inside a `#for`. The scope of a template now links to the scope where its output is inserted, and errors go on from there.
- bff9d65: A `#try` now catches the client errors of a `#template` that its body calls, such as a click handler that throws, an async handler that rejects or an effect that throws. Before, the error went past the `#catch` to `onError` and `brumate:error` in two cases: a template declared outside the `#try` and called in it, and a template in the `#try` that holds a component.
- 2fb5a44: A component that the browser renders now handles the rejection of an async memo that nothing reads. The error goes to the nearest `#try`, or to `onError` and the `brumate:error` event when no `#try` catches it. Before, the page got an unhandled rejection.

## 0.4.1

### Patch Changes

- fd9041e: A `b-` attribute value that one copy of brumate made is now kept by another copy. Before, the runtime checked it with `instanceof`, so with two installed copies (a component library with its own brumate, or a hot update that evaluates the runtime again) a `b-` attribute was dropped from a spread and the value was left out of the page state.
- bf3ff87: An effect in a child that calls a writer of a context no longer runs again on its own write. The context stays live: markup, memos and other effects that call a reading function of it still update. Before, the effect ran without end and the tab hung.
- bca63b3: The client build no longer ships Vite's preload helper and its tables of chunk files. A lazy chunk is still held back until its stylesheets have loaded, the scripts of a page come with the `Link` headers of the server, as before, and the imports of a lazy chunk that no header covers (such as the stream chunk of the first server function call) load along with it. The entry chunk of a large app (the website) is 13 kB smaller gzipped, the todos page 0.6 kB. The table of the bundles of the client also leaves out the components that are their own bundle.
- 26a22e5: A prop write to a child whose code fails to load now reaches the nearest `#catch`. Before, the rejection was unhandled, no `#try` caught it and the `#catch` never rendered.
- e62bfda: A memo, markup or effect in a child that reads a function prop now runs again when the state the function reads changes. The function stays fixed, as before, when it writes state or calls through a context value or a prop outside `$untrack`, and a prop named `onX` is always fixed. See [the debate](https://github.com/lxsmnsyc/brumate/blob/main/docs/debates/function-prop-derivations/debate.md).
- 6f739a4: A `ref=$bind(x, fn)` that reaches an element through the rest props of a component now calls `fn` once on resume, for markup the server rendered.
- af5c562: `<Child label=$untrack(fn) />` now ships `fn` to the browser and keeps the writes of handlers to the state it reads. Before, the page had no client code for `fn` and a handler such as `name = 'Grace'` compiled to a bare value, so the write was lost. The prop stays fixed, and the child gets the current value when it calls `fn`.
- 3ce1113: A `$client(fn, 'visible')` that reads an element through a forwarded `ref` now waits for that element to come into view.

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
