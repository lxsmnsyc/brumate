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

| Arguments                       | Body                                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No files                        | `content-type: application/json`. The arguments array as seroval JSON, from `toJSONAsync`.                                                                                                                  |
| Files or blobs in the arguments | `x-brumate-args: form`, and multipart form data. The `args` field holds the seroval JSON. Each file is a field named `file<index>`, and the JSON holds a `brumate/upload` node with the index in its place. |

- Files are found anywhere in the arguments, such as in a `Map` or in a `FormData`, by the plugin of uploads, which seroval runs on each value. A file that comes twice is sent once.
- The server reads the JSON with `fromJSON`, and the plugin of uploads reads each index as the `File` of the form.
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

- `x-brumate-refresh: <id>,<id>` lists the server functions that `refresh` named during the call. The client loads again the memos that call those functions, and dispatches `brumate:refresh` on `document` with their IDs.
- Headers that the function set on its event, such as cookies, are on the answer.
- The client throws an error named `ServerError`, with the message and the status, for an error answer.

## Chunk stream

A value answer is a byte stream of [`@seroval/transport`](https://github.com/lxsmnsyc/seroval) frames. The server writes it with `createJSONWriter` and `toWebStream`, and the client reads it with `createJSONReader` and `fromWebStream`. Each frame is a 12-byte header and the data:

```
;0x00000021;[0,"answer",{"t":10,"i":0,"p":{…}}]
```

- The header is `;0x`, the size of the data in bytes as 8 hex digits, and `;`.
- The data is a transport message: `[0, key, node]` carries a seroval cross-reference JSON node, `[1, key]` says the value and everything in it settled, and `[2, key]` says the writer failed or cancelled the value.
- The key is `answer`. The first data message is the value, and the client returns it from the call.
- Later data messages settle the promises and the async iterables in the value. The client reads them in the background.
- When the stream ends, any promise or iterable that still waits fails. A promise that fails with nothing reading it does not report an unhandled rejection.
- The reader refuses a frame over 64 MiB.
- A value that cannot be serialized, such as a function, fails the answer on the client, and the error goes to the `onError` of the app on the server.

The size in the header lets the reader wait for exactly the bytes of one frame. A page and a server of different builds cannot read each other's frames. The skew check answers 409 first, so the page loads again.

## Forms

| Form                            | Request                                                                       | Answer                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `action=fn`, without scripts    | The browser posts the form to `<prefix>/<ID>`.                                | 303 to the `Referer`, or to the location of a `redirect`. An error is text with its status. |
| `action=fn`, with the loader    | The loader sends the same post with `fetch`, and loads the answer as a page.  | The same, which the loader follows.                                                         |
| `$action` form, without scripts | The browser posts the form to its own page, with `?__action=<ID>`.            | The page, rendered with the result in the `$action`. A `redirect` answers with a redirect.  |
| `$action` form, with the loader | The loader posts the form data to `<prefix>/<ID>` with `x-brumate-result: 1`. | A value answer, written into the `$action`.                                                 |

An `$action` form carries `b-action="<ID>"` and `b-result="<scope>:<slot>"`, the slot of its `$action`.

In a build, the URL of each form also carries `__build=<build ID>`. A post from another build to a function that is gone answers 303 to the `Referer` when it is on the same site, or to `/`. A post to `<prefix>/`, with no ID, answers 204 with the build of the server in `x-brumate-build`. The browser asks it when the code of a handler fails to load. See [Skew protection](./deploying.md#skew-protection).

A form post checks where it comes from, as a call does. See [Security](./reference-security.md).

## Navigation requests

When the loader loads a page, it sends `x-brumate-base`, the first ID that the new page should use. See [Page format](./page-format.md#navigation).
