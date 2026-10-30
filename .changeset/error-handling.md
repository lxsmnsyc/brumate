---
'brumate': patch
---

- An error inside a streamed `#loading` body renders the nearest `#catch`, in the body, around the block or in a parent component. The real error shows in development and a generic one in production. After a client navigation, a `#loading` body that never arrives because the stream ended fires `brumate:error`, and its fallback stays.
- In production, a `#catch` no longer sends server error details to every visitor. It gets a plain `Error` with the message of a `ServerError`, or a generic message. The real error is logged on the server.
- An error of code that fails to load no longer leaves an unhandled promise rejection.
