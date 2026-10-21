---
'brumate': patch
---

- A value in a `<textarea>` or a `<title>` renders without comment markers, which became part of the text. A value that changes must be the whole content of the element, and the compiler reports one that is not. The client sets the text, and the `value` of a `<textarea>`.
- A `#try` body that throws on the server no longer leaves anything in the page: its stylesheets are sent with the next copy of the component, and its `#portal` and `#head` markup, its title and its `#loading` bodies are left out.
- `brumate-tsc` no longer reports TS2440 when a file imports the name that its file name gives the component, such as `SignIn` in `sign-in.brm`.
- Prerendering writes the SHA-256 hashes of the inline scripts of each page to `.brumate/prerender.json` in the client build, for a Content Security Policy without a nonce.
