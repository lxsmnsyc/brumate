---
'brumate': minor
---

Add `$searchParam(name, options)` to `brumate/signals`. It gives a signal bound to one parameter of the query string: the server renders the value of the URL, a write in the browser changes the URL with `replaceState` (or `pushState` with `{ history: 'push' }`) and asks the server nothing, and back and forward write the signal. `parse`, `serialize` and `default` convert the value, and `{ server: true }` asks the server for the page again.
