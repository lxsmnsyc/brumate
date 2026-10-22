---
'brumate': minor
---

An error in client code goes to the nearest `#try` around the scope of the code: a handler that throws, or whose promise rejects, an effect, a `$client` callback, or a memo whose load rejects. The `#catch` body renders in the browser, with the error and `reset`. A `#try` whose body holds client code ships both bodies. Without a `#try`, the page gets a `brumate:error` event on `window`, with the error and the scope, and the error is logged. `onError` of the loader receives every error first.
