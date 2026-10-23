---
'brumate': minor
---

The page state and server function calls send the web values of `seroval-plugins`: `Headers`, `FormData`, `Request`, `Response`, `ReadableStream`, `AbortSignal`, `Event`, `CustomEvent` and `DOMException`, next to `URL` and `URLSearchParams`, whose plugins replace brumate's own. A `ReadableStream` streams its chunks as they are ready. An `AbortSignal` goes as it is when sent, with whether it aborted and its reason. `Blob` and `File` still go only in the arguments of a call, as parts of multipart form data, and now from anywhere in them, such as a `Map`, a `Set` or a `FormData`.

The sync paths of the page state and of shared calls no longer take an async iterable as an empty stream: the page state streams it, and a call with one in its arguments is not shared with another.
