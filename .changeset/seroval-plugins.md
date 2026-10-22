---
'brumate': minor
---

The page state and server function calls send the web values of `seroval-plugins`: `Headers`, `FormData`, `Request`, `Response`, `ReadableStream`, `AbortSignal`, `Event`, `CustomEvent` and `DOMException`, next to `URL` and `URLSearchParams`, whose plugins replace brumate's own. A `ReadableStream` streams its chunks as they are ready. `Blob` and `File` still go only in the arguments of a call.

The sync paths of the page state and of shared calls no longer take an async iterable as an empty stream: the page state streams it, and a call with one in its arguments is not shared with another.
