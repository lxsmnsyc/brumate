# brumate

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
