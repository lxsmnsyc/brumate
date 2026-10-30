---
'brumate': minor
---

A promise prop is a plain promise in the child. The browser no longer unwraps it into its value, and after the page resumes a streamed promise prop is a promise that settles with the streamed value (or rejects with its error). `await user`, `user.then(…)` and passing it on work in a handler, an effect and a `$client` callback, before and after it settles. `$memo(user)` still gives a value that is pending until it settles. Code that read the value of a promise prop directly, such as `user.name`, reads it through `$memo(user)`. A handler that read a promise prop no longer throws that the value is still loading. Two behavior changes follow from the prop being a plain value: an effect that reads a promise prop no longer runs again when the promise settles, since the prop does not change (it runs when its other dependencies change, or the effect awaits the promise), and `$isPending(prop)` of a promise prop is false (use `$isPending` of a `$memo(prop)`).
