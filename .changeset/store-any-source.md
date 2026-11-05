---
'brumate': minor
---

`$store(source)` takes any expression that gives a store or a context that holds one. That includes an import, a prop, a value of `<script module>`, a call, and a store made there, as `$store(store(0))`. A source that gives `undefined` or `null` gives `undefined`, so `$store(field?.state)` reads a guarded `$getContext` value, typed `T | undefined`. On resume the browser runs a source that is not a context once, with the values the page resumed. It subscribes, and writes the variable once if the store's value differs from the server's. It never calls `set`. A store that the source makes starts from its first value in the browser. `let` on a source that gives no store throws a `TypeError` when the variable registers. BRM194 is removed. A source that awaits or calls a server function is BRM198. A store of another library in a prop or a script value that `$store` reads makes the server render throw an error that names the component and the value.
