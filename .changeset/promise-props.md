---
'brumate': minor
---

Breaking: a promise prop is a plain promise in the child. The browser no longer unwraps it into its value, and after the page resumes a streamed promise prop is a promise that settles with the streamed value or rejects with its error.

- `await user`, `user.then(...)` and passing it on work in a handler, an effect and a `$client` callback, before and after it settles.
- Code that read the value of a promise prop directly, such as `user.name`, reads it through `$memo(user)`.
- An effect that reads a promise prop no longer runs again when the promise settles. `$isPending(prop)` of a promise prop is false. Use `$isPending` of a `$memo(prop)`.
- `$memo` of a promise prop, and a memo that loads, now load in a component that the browser renders, such as a child inside `#if`. Before, its markup stayed on `[object Promise]`.
