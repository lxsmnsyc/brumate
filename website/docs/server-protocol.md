# Server function protocol

How the browser calls a server function, and how the server answers. App code never sees this: a call is a normal `await fn(args)`. It matters for a custom server, a proxy, or a client in another language.

## Function IDs

Each server function has an ID: `<component ID>#<function name>`, such as `Todos_t3g9lr#persist`. A build hashes the name, as in `Todos_t3g9lr#f1k2m3n`, so the browser does not see it.

- The component ID is the component name and a hash of the file's path relative to the root, so it is the same on every machine.
- A `'use server'` file has an ID of the same form, from its file name and path.
- In development the ID keeps the name of the function, so the network panel and the devtools show it.
- On the server, `virtual:brumate/server` exports `functions`, every server function by ID.
- In the browser, the function is a stub that calls the server with its ID. Its body never ships.

## Calls

A call is a `POST` to `<rpc prefix>/<encoded ID>`. The prefix is `/_brumate` by default.

| Arguments                       | Body                                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No files                        | `content-type: application/json`. The arguments array as seroval JSON, from `toJSONAsync`.                                                                                                            |
| Files or blobs in the arguments | `x-brumate-args: form`, and multipart form data. The `args` field holds the seroval JSON. Each file is a field named `file<index>`, and the JSON holds an `Upload` value with the index in its place. |

- Files are found in the arguments, and in the arrays and plain objects inside them.
- The server reads the JSON with `fromJSON`, then puts each `File` from the form in place of its `Upload`.
- Promises in the arguments are awaited before the call is sent.
- The request can carry an `AbortSignal`. A memo that computes again aborts the calls of its last run, and the server sees `request.signal` abort, if its HTTP server reports it.

## Answers

| Outcome              | Status     | Headers                                      | Body                                                                |
| -------------------- | ---------- | -------------------------------------------- | ------------------------------------------------------------------- |
| A value              | 200        | `content-type: application/x-brumate-stream` | A chunk stream of the value. See below.                             |
| `redirect(location)` | 204        | `x-brumate-redirect: <location>`             | None. The browser goes to the location, and the call never settles. |
| `ServerError`        | its status | `content-type: application/json`             | `{ "error": "<message>" }`                                          |
| Any other error      | 500        | `content-type: application/json`             | `{ "error": "The server function failed" }`                         |
| Another site         | 403        |                                              | Text.                                                               |
| Unknown ID           | 404        |                                              | Text.                                                               |

- `x-brumate-refresh: <id>,<id>` lists the server functions that `refresh` named during the call. The client dispatches `brumate:refresh` on `document`, and the core loads again the memos that call those functions.
- Headers that the function set with `getResponseHeaders`, such as `set-cookie`, are on the answer.
- The client throws an error named `ServerError`, with the message and the status, for an error answer.

## Chunk stream

A value answer is a stream of seroval cross-reference JSON nodes, from `toCrossJSONStream`. Each chunk is a 12-byte header and the data:

```
;0x0000001f;{"t":10,"i":0,"p":{…}}
```

- The header is `;0x`, the size of the data in bytes as 8 hex digits, and `;`.
- The first chunk is the value. The client reads it with `fromCrossJSON`, and returns it from the call.
- Later chunks settle the promises and the async iterables in the value. The client reads them in the background with the same `refs` map.
- When the stream ends, any promise or iterable that still waits fails. A promise that fails with nothing reading it does not report an unhandled rejection.

The size in the header lets the reader wait for exactly the bytes of one chunk. The format follows the one of SolidStart.

## Forms

| Form                            | Request                                                                       | Answer                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `action=fn`, without scripts    | The browser posts the form to `<prefix>/<ID>`.                                | 303 to the `Referer`, or to the location of a `redirect`. An error is text with its status. |
| `action=fn`, with the loader    | The loader sends the same post with `fetch`, and loads the answer as a page.  | The same, which the loader follows.                                                         |
| `$action` form, without scripts | The browser posts the form to its own page, with `?__action=<ID>`.            | The page, rendered with the result in the `$action`. A `redirect` answers with a redirect.  |
| `$action` form, with the loader | The loader posts the form data to `<prefix>/<ID>` with `x-brumate-result: 1`. | A value answer, written into the `$action`.                                                 |

An `$action` form carries `data-action="<ID>"` and `data-result="<scope>:<slot>"`, the slot of its `$action`.

A form post checks where it comes from, as a call does. See [Security](./reference-security.md).

## Navigation requests

When the loader loads a page, it sends `x-brumate-base`, the first ID that the new page should use. See [Page format](./page-format.md#navigation).
