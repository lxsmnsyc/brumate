# Server functions

A function with the `'use server'` directive runs only on the server. Client code that calls it sends its arguments to the server and receives the result.

## Function directive

The directive is allowed in the module script, the instance script and block scripts:

```ts
async function persist(list: Todo[]) {
  'use server';
  await db.save(list);
  return list.length;
}
```

## File directive

Every export of a module that starts with `'use server'` is a server function:

```ts
// todos.server.ts
'use server';

export async function persist(list: Todo[]) {
  await db.save(list);
}
```

## Rules

- The function must be `async`.
- Its arguments and its return value must be [serializable](./model.md#serialization).
- It may capture module-scope bindings and imports only. Capturing a variable of the instance script or a block script is a compile error:

  ```
  Server function "persist" captures "user" (Todos.brm:6:3). Pass it as an argument.
  ```

- Arguments come from the client, so the function must treat them as untrusted input.

The capture rule keeps everything that the client sends in the arguments. There are no serialized closures to encrypt or sign.

## Output

- On the server, a call from setup code is a direct call.
- On the client, the function becomes a stub: `rpc('<id>', args)`. Its body never ships.
- The ID is a hash of the file and the function, so source names are not exposed.

The compiler splits server functions into their own modules itself. See [Compiler](./compiler.md#code-splitting).

## The request

Server functions read the request, set response headers, and answer with errors and redirects through `brumate/server`:

```ts
import { ServerError, getRequest, getResponseHeaders, redirect } from 'brumate/server';

async function login(name: string) {
  'use server';
  if (name === '') {
    throw new ServerError('A name is required', { status: 422 });
  }
  if (name === 'admin') {
    redirect('/admin');
  }
  const agent = getRequest().headers.get('user-agent');
  getResponseHeaders().set('set-cookie', `user=${name}`);
  return `Hello ${name}`;
}
```

- `getRequest()` returns the web `Request` of the call.
- `getResponseHeaders()` returns headers that are added to the response, such as `set-cookie`.
- `throw new ServerError(message, { status })` answers with that status, and the call on the client rejects with an error that has the message. The status defaults to 400.
- Any other error answers with status 500 and a generic message, so server details do not reach the browser. The error is logged on the server.
- `redirect(location)` stops the function, and the browser goes to `location`.

These work while a page renders too, when `render` or `renderToStream` gets the request. The setup code of a component runs on the server, so it can call them directly. One more works only while a page renders:

- `setStatus(status)` sets the status of the page response, such as 404.

```ts
const { headers, status } = await render(Root, props, { request });
```

`headers` holds the response headers that were set while the page rendered, and `status` is the status that `setStatus` set, or 200. Only the first render can set them. Markup that streams later, such as a `#loading` body, cannot, because the response has started by then. A `redirect` during rendering rejects `render`, or errors the stream of `renderToStream`, with an error that `isRedirect` recognizes, so the server can answer with a redirect.

The request is kept with `AsyncLocalStorage` from `node:async_hooks`, so the server runtime needs a runtime that has it.

## In a `$memo`

A `$memo` that calls a server function loads its value on the server, and again on the client when the values it reads change:

```ts
let id = $signal(1);
const user = $memo(getUser(id));
```

When `id` changes on the client, the client calls `getUser` through RPC, and the page keeps the old `user` until the call answers. Data access stays on the server, and the client only holds the stub. See [`$memo`](./syntax.md#memo).

## No `'use client'`

There is no `'use client'` directive. The compiler decides what ships by following client roots. See [Execution model](./model.md#client-roots).
