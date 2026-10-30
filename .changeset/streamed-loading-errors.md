---
'brumate': patch
---

An error inside a streamed `#loading` body renders the nearest `#catch`, in the body or around the block, with the real error in development and a generic one in production. Before, the fallback stayed and the server only logged the error. After a client navigation, a `#loading` body that never arrives because the stream ended fails the same way.
