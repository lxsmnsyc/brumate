---
'brumate': patch
---

A memo that failed on the server holds its error in the browser. A handler, an effect or a binding that reads it after resume throws to the nearest `#try`, and no longer reads `undefined`. The page state no longer fails the response for it. In development the browser gets the error as seroval writes it: name, message, own properties, `cause` and the `errors` of an `AggregateError`. In production it gets the message of a `ServerError`, or "The page could not compute a value", and the server logs the error. A stack is never sent.
