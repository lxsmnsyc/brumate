---
'brumate': patch
---

An error inside a streamed `#loading` body renders the nearest `#catch`, in the body, around the block or in a parent component. The real error shows in development and a generic one in production. A reader without scripts gets the `#catch` in place. Before, the fallback stayed and the server only logged the error. After a client navigation, a `#loading` body that never arrives because the stream ended fails the same way.
