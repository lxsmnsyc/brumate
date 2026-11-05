---
'brumate': minor
---

Breaking. `createContext(key)` takes only a key, and a context has no default value. `$getContext(Ctx)` and `$store(Ctx)` throw when no provider above the reader set the context, on the server and in the browser: `The context "key" has no provider above this component. Provide it with $setContext, or in a parent that does`. A default was one object for every request on the server, which made a context a global. `$route()` and `$navigation()` still read on every page. To migrate, delete the second argument of `createContext` and provide the value with `$setContext` in a component above the readers.
