---
'brumate': minor
---

Breaking: a memo that throws, or whose promise rejects, holds its error, and each read of it throws into the nearest `#try` around the reader. Before, the error went to the `#try` around the memo, and a rejected memo kept its old value.

- A memo that failed on the server holds its error in the browser after resume. A handler, an effect or a binding that reads it throws to the nearest `#try`, and no longer reads `undefined`.
- A memo that throws on the server renders the `#catch` of the nearest `#try` that reads it, also when the memo is declared outside the `#try`. An awaited memo still throws at its declaration.
- In development the browser gets the error with its name, message, own properties and `cause`. In production it gets the message of a `ServerError`, or "The page could not compute a value". A stack is never sent.
