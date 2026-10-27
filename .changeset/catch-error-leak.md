---
'brumate': patch
---

In production, a `#catch` no longer sends server error details to every visitor. When code in a `#try` throws while the server renders, the `#catch` body and the page state get a plain `Error` with the message of a `ServerError`, or a generic message for any other error. The real error is logged on the server. In development the error is kept as it was.
