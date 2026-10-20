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

## Async `$memo`

An async `$memo` may only call server functions:

```ts
const user = $memo(getUser(id));
```

When `id` changes on the client, the client calls `getUser` through RPC. Data access stays on the server, and the client chunk for the memo only holds the stub.

## No `'use client'`

There is no `'use client'` directive. The compiler decides what ships by following client roots. See [Execution model](./model.md#client-roots).
