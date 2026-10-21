---
'brumate': minor
---

Pages are smaller and render faster, and the first click needs less code. This changes the page format, so the server and the client must come from the same version.

- The page state is written as inline scripts. Pages with a Content Security Policy must pass `nonce` to `render`. Code that read `type="brumate/state"` scripts as JSON must change.
- The attributes that brumate writes start with `b-` instead of `data-`, such as `b-b` and `b-on`. An element attribute that starts with `b-` is now a compile error. `data-prefetch` and `data-reload` are unchanged.
- `brumate/client` no longer exports `context`. `portal` is now `portalTo`, and `provide` is now `updateContext`.
- The core no longer listens to the `brumate:hot`, `brumate:remount` and `brumate:refresh` events.
- After `load`, pages preload the code of components with handlers near the viewport. Set `preload: false` to turn it off.
- `brumate/static-loader` is the loader without client navigation. The plugin uses it with `navigate: false`.
- `brumate/server` exports `parse`, `safeParse`, `parseForm` and `fieldErrors`, which check server function arguments with any Standard Schema library.
- A `'use server'` function declared in `<script module>` can now be called from the browser.
- A path with a malformed escape, such as `/%E0`, answers 404 instead of 500.
