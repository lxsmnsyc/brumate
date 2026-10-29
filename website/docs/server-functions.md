# Server functions

A function with `'use server'` runs only on the server. Client code calls it like any other async function: the arguments go to the server, and the result comes back.

```brm live
<script>
  import { $signal } from 'brumate/signals';

  async function greet(name: string) {
    'use server';
    // This body never reaches the browser.
    return `Hello, ${name}. The server says it is ${new Date().toLocaleTimeString()}.`;
  }

  let message = $signal('');
</script>

<button onClick=(async () => (message = await greet('Ada')))>Ask the server</button>
<p>{message}</p>
```

The function body, and anything only it uses, such as a database client, stays on the server. The browser gets a small function that sends the call.

## Declaring them

Put `'use server'` at the top of an `async` function, in any script of a component:

```ts
async function save(list: Todo[]) {
  'use server';
  await db.todos.save(list);
  return list.length;
}
```

An import that only server functions use stays on the server, so a database client can be imported at the top of the component:

```ts
import { db } from '../db.ts';

async function listTodos() {
  'use server';
  return db.todos.all();
}
```

### A file of server functions

Put `'use server'` at the top of a `.ts` file, and every function that it exports is a server function. Components import them like any function:

```ts
// src/todos.ts
'use server';

import { db } from './db.ts';

export async function listTodos() {
  return db.todos.all();
}

export async function saveTodo(todo: Todo) {
  await db.todos.save(todo);
}
```

```brm
<script>
  import { listTodos, saveTodo } from '../todos.ts';
</script>
```

- The browser gets a stub for each export, which calls the server. The code of the file, and everything that it imports, never ships.
- The file exports only functions. A constant or a class is a build error, because the browser could only get a stub of it.
- Any code can import the file, including other `.ts` files. On the server, the calls are plain function calls.
- [`event.refresh(fn)`](./async-data.md#loading-again) works with the functions of a file too. Memos of components that call `fn` from the file load again.

There is no `'use client'`. The compiler decides what reaches the browser by following event handlers and other client code. See [What runs where](./what-runs-where.md).

## Calling them

From a handler, `await` the call. The handler runs in the browser, so the call goes over the network.

From the setup code of a component, the call is a plain function call on the server, because setup code runs only there.

From a `$memo`, the value loads on the server for the first render, and again in the browser when the values that the memo reads change:

```ts
let id = $signal(1);
const user = $memo(getUser(id));
```

[Async data](./async-data.md) covers memos that load data, `$isPending` and `#loading`.

## Rules

- The function must be `async`.
- Its arguments and its result must be serializable: plain data, `Date`, `Map`, `Set`, `URL`, typed arrays, and more. See [Serializable values](./reference-serialization.md).
- It can use imports and values of `<script module>`. It cannot use a variable of the instance script. Pass the value as an argument instead.
- Its arguments come from the browser, so treat them as untrusted input. Check them before you use them. See [Validating arguments](#validating-arguments).

Capturing an instance variable is a compile error that names the variable:

```
Server function "save" captures "user" (Todos.brm:6:3). Pass it as an argument.
```

## Validating arguments

The types of a server function do not check what the browser sends. `parse` from `brumate/server` checks a value with a schema, and returns the value that the schema gives back:

```ts
import { parse } from 'brumate/server';
import * as v from 'valibot';

const Todo = v.object({ title: v.pipe(v.string(), v.minLength(1)), done: v.boolean() });

async function save(input: unknown) {
  'use server';
  const todo = await parse(Todo, input);
  await db.todos.save(todo);
}
```

- Any schema that follows [Standard Schema](https://standardschema.dev) works, such as one of Zod, Valibot or ArkType. brumate does not depend on a library.
- A value that does not match throws a `ValidationError`, which is a `ServerError` with status 400. Its message is the first issue with its path, such as `title: Invalid length (1 more issue)`. The call in the browser rejects with that message, and a form posted without scripts gets it as text.
- The message has at most 300 characters of the issue. Only the message reaches the browser. The issues stay on the server, in `error.issues`.
- Call `getEvent()` before `parse`, because `parse` awaits the schema.
- The schema and the helpers stay on the server when only server functions use them.

`safeParse(schema, value)` does not throw. It returns `{ value }` or `{ issues }`, so the function can return the issues for the page to show:

```brm live
<script module>
  import type { StandardSchemaV1 } from 'brumate/server';

  // A schema written by hand. A schema library makes the same object.
  const Name: StandardSchemaV1<unknown, string> = {
    '~standard': {
      version: 1,
      vendor: 'sample',
      validate: (value) =>
        typeof value === 'string' && value.trim().length >= 2
          ? { value: value.trim() }
          : { issues: [{ message: 'Use at least 2 letters' }] },
    },
  };
</script>

<script>
  import { $signal } from 'brumate/signals';
  import { safeParse } from 'brumate/server';

  async function rename(input: unknown) {
    'use server';
    const result = await safeParse(Name, input);
    if (result.issues) {
      return { error: result.issues[0]!.message, name: '' };
    }
    return { error: '', name: result.value };
  }

  let draft = $signal('');
  let answer = $signal({ error: '', name: '' });
</script>

<input aria-label="Name" value=draft onInput=((event) => (draft = event.currentTarget.value))>
<button onClick=(async () => (answer = await rename(draft)))>Save</button>
#if (answer.error) {
  <p role="alert">{answer.error}</p>
} #else if (answer.name) {
  <p>Saved as {answer.name}</p>
}
```

- Each issue is plain data: a `message`, and a `path` of strings and numbers. A `{ key }` segment becomes its key, and a symbol becomes its text, such as `Symbol(id)`. Other fields that a library adds to an issue are left out, so they cannot send the input back.
- `fieldErrors(issues)` groups the messages by field. See [Validating a form](./forms.md#validating-a-form).

## Errors

Throw a `ServerError` to answer with a message and a status. The call in the browser rejects with an error that has the same message.

```brm live
<script>
  import { $signal } from 'brumate/signals';
  import { ServerError } from 'brumate/server';

  async function rename(name: string) {
    'use server';
    if (name.trim() === '') {
      throw new ServerError('A name is required', { status: 422 });
    }
    return name.trim();
  }

  let draft = $signal('');
  let saved = $signal('');
  let problem = $signal('');

  async function save() {
    try {
      saved = await rename(draft);
      problem = '';
    } catch (error) {
      problem = (error as Error).message;
    }
  }
</script>

<input aria-label="Name" value=draft onInput=((event) => (draft = event.currentTarget.value))>
<button onClick=save>Save</button>
#if (problem) {
  <p role="alert">{problem}</p>
} #else if (saved) {
  <p>Saved as {saved}</p>
}
```

- The status of a `ServerError` defaults to 400.
- Any other error answers with status 500 and a generic message, so details of the server do not reach the browser. The server logs the error.

### Errors as values

A thrown error reaches the browser as a message, and `catch` types it as `unknown`. To let the page tell errors apart by type, return them as values. The browser gets the return type of the server function, so TypeScript narrows the result and checks each case:

```brm live
<script module>
  type Renamed =
    | { ok: true; name: string }
    | { ok: false; error: 'empty' }
    | { ok: false; error: 'taken'; suggestion: string };

  const taken = new Set(['ada', 'grace']);
</script>

<script>
  import { $signal } from 'brumate/signals';

  async function rename(input: string): Promise<Renamed> {
    'use server';
    const name = input.trim().toLowerCase();
    if (name === '') {
      return { ok: false, error: 'empty' };
    }
    if (taken.has(name)) {
      return { ok: false, error: 'taken', suggestion: `${name}2` };
    }
    return { ok: true, name };
  }

  function describe(result: Renamed): string {
    if (result.ok) {
      return `Saved as ${result.name}`;
    }
    switch (result.error) {
      case 'empty':
        return 'A name is required';
      case 'taken':
        return `That name is taken. Try ${result.suggestion}`;
    }
  }

  let draft = $signal('');
  let result = $signal<Renamed>();
</script>

<input aria-label="Name" value=draft onInput=((event) => (draft = event.currentTarget.value))>
<button onClick=(async () => (result = await rename(draft)))>Save</button>
#if (result) {
  <p role=(result.ok ? 'status' : 'alert')>{describe(result)}</p>
}
```

- An error value can carry data, such as `suggestion`. It crosses the connection as any other value does. See [Serialization](./reference-serialization.md).
- A new case in the union, such as `{ ok: false; error: 'reserved' }`, is a type error in `describe`. `describe` must return a string, so the page has to handle the case.
- Keep `throw` for errors that the page does not tell apart. Throw a `ServerError` for a message and a status. Any other error is a bug.

## The request

`getEvent()` from `brumate/server` returns the event of the call: its request, and methods that change the response. Call it before the first `await` of the function, and keep it in a variable:

```ts
import { ServerError, getEvent, redirect } from 'brumate/server';

async function login(name: string) {
  'use server';
  const event = getEvent();
  const agent = event.request.headers.get('user-agent');
  const user = await db.users.find(name);
  if (!user) {
    throw new ServerError('Unknown user', { status: 404 });
  }
  event.setCookie('user', user.id);
  return `Hello ${user.name}`;
}
```

- `event.request` is the web `Request` of the call, with its headers and its `signal`.
- `event.headers` are headers to add to the response, such as `cache-control`.
- `redirect(location)` stops the function, and the browser goes to `location`. It needs no event.
- `event.waitUntil(promise)` keeps work going after the response ends, such as a log line or analytics. On a host that stops a function when its response ends, such as Cloudflare Workers, pass the host's `waitUntil` in the options of `handle`, and the promise goes to it. Elsewhere the promise runs on its own, and its error is logged.

**Why before the first `await`:** a server handles many requests at once, and other requests run while one waits. The runtime sets the event while it starts the function, and clears it at the function's first `await`. After that, `getEvent()` throws, so it never returns the event of another request. The event in your variable stays right after any number of awaits.

**Helpers take the event as an argument:**

```ts
async function checkout(cart: Cart) {
  'use server';
  const event = getEvent();
  const user = await currentUser(event);
  await charge(user, cart);
  event.refresh(listOrders);
}
```

This needs no `AsyncLocalStorage` or other runtime support, so it runs on any host.

In a component, `getEvent()` returns the event of the page anywhere in its script while the page renders. There, `event.setStatus(404)` also sets the status of the page. See [Routing](./routing.md#errors-and-404). Middleware and endpoints read it before their first `await`, as server functions do.

When the browser no longer needs an answer, such as a memo whose input changed again, it aborts the call. `event.signal` tells the function, so it can stop work it no longer needs. It aborts when `event.request.signal` does, and when the reader of the answer goes away:

```ts
async function search(query: string) {
  'use server';
  return db.products.search(query, { signal: getEvent().signal });
}
```

When the browser leaves while a page streams, `getEvent().signal` aborts too: for a page, a server function call and the request for a [`#defer`](./async-data.md#defer) body. The bodies that are not sent yet are not sent.

- Work that must finish, such as a log line, does not read the signal, and passes its promise to `getEvent().waitUntil` where the server has it.
- It needs the host to report a closed connection. Node's streams do, and Nitro passes it on for most presets.

## Cookies and sessions

The event reads the cookies of the request and sets them on the response:

```ts
import { getEvent } from 'brumate/server';

async function chooseTheme(theme: 'light' | 'dark') {
  'use server';
  getEvent().setCookie('theme', theme, { maxAge: 60 * 60 * 24 * 365 });
}

async function currentTheme() {
  'use server';
  return getEvent().getCookie('theme') ?? 'light';
}
```

- A cookie is `HttpOnly`, `SameSite=Lax` and on the path `/`, unless the options say otherwise, and `Secure` on HTTPS. `event.deleteCookie(name)` deletes one.
- They work in server functions, in middleware and endpoints, and while a page renders its first part. Markup that streams later, such as a `#loading` body, cannot set cookies, because the response has started.
- After `setCookie`, `getCookie` on the same event reads the new value.

`createSession` keeps data in a signed cookie, such as who is logged in:

```ts
// src/session.ts
import { createSession } from 'brumate/server';
import env from './env.ts';

export const session = createSession<{ userId: string }>({
  secret: env.SESSION_SECRET,
});
```

```ts
// src/auth.ts
'use server';

import { getEvent, redirect } from 'brumate/server';
import { session } from './session.ts';

export async function login(form: FormData) {
  const event = getEvent();
  const user = await checkPassword(String(form.get('email')), String(form.get('password')));
  await session.set(event, { userId: user.id });
  redirect('/');
}

export async function logout() {
  session.clear(getEvent());
  redirect('/login');
}

export async function currentUser() {
  const data = await session.get(getEvent());
  return data && findUser(data.userId);
}
```

- `get(event)` returns undefined when there is no session, when it expired, or when its signature does not match, such as after a browser changed it.
- `set(event, data)` replaces the data and starts its time again. `update(event, change)` changes some fields. `clear(event)` ends the session.
- The secret is at least 32 characters, kept out of the code. A list of secrets signs with the first and accepts all of them, so a secret can change without ending every session.
- Sessions last 7 days unless `maxAge` says otherwise, in seconds.
- The browser can read the data, but cannot change it. Keep secrets out of it: store an ID, and look the rest up on the server. A cookie holds about 4 KB.

A custom Node server sends the cookies with `toNodeHeaders(answer.headers)`, which keeps each one apart. See [Deploying](./deploying.md).

## Files

Pass a `File` or a `Blob` as an argument, or inside an array or a plain object. The server function gets a `File`.

```brm live
<script>
  import { $signal } from 'brumate/signals';

  async function measure(file: File) {
    'use server';
    return `${file.name} has ${(await file.arrayBuffer()).byteLength} bytes`;
  }

  let result = $signal('');
</script>

<label>
  Choose a file
  <input type="file" onChange=(async (event) => {
    const file = event.currentTarget.files?.[0];
    if (file) {
      result = await measure(file);
    }
  })>
</label>
<p>{result}</p>
```

## Streaming results

A server function can return a promise or an async iterable, alone or inside other values. Each one settles in the browser as soon as the server has it, while the rest of the answer is still on its way. A `$memo` of an async iterable shows each value in turn. See [Async data](./async-data.md#streams).

## One call for the same arguments

While a page renders, calls of the same server function with the same arguments share one result. Two components that load `getUser(1)` make one call:

```ts
// Header.brm and Sidebar.brm, on one page
const user = $memo(getUser(id));
```

- It holds for the server functions of components and of `'use server'` files.
- Arguments are compared by value, as they would be sent, so `getUser({ id: 1 })` twice is one call.
- Each render starts with no results, so a new request loads fresh data.
- Calls from the browser, such as from a handler, always run. A function that changes something, such as `save(todo)`, runs each time it is called.

## Results that requests share

`cached` from `brumate/server` keeps the results of a function for a time, by its arguments, so the next request gets them without running it. Use it for data that every user sees the same:

```ts
// issues.ts
'use server';

import { cached, revalidate } from 'brumate/server';

export const listIssues = cached(async (status: string) => db.issues(status), {
  maxAge: 30,
  tags: (status) => ['issues', `issues:${status}`],
});

export async function closeIssue(id: string) {
  await db.close(id);
  await revalidate('issues');
}
```

- A result is used for `maxAge` seconds, for the same arguments. Calls with the same arguments while one runs share that run.
- The function runs without the request, so `getEvent()` throws in it. A result can never hold one user's data by mistake. Pass what it needs as arguments, which are part of the key.
- Arguments and results are values that brumate can send, such as plain objects, arrays, dates and maps. Each caller gets its own copy.
- `revalidate(...tags)` drops the results with those tags. The page shows the new data when the browser loads it again, such as with `refresh(listIssues)`.
- An error is not kept, so the next call runs again.
- A `'use server'` file can export a function that `cached` makes, so the browser can call it.

Results live in the memory of the server by default, up to 1000 of them. With several processes, such as on a serverless host, give each function a `name` and a store that they share:

```ts
import { cached, setCacheStore, storageStore } from 'brumate/server';

setCacheStore(storageStore(useStorage('cache')));

export const listIssues = cached(load, { name: 'issues', maxAge: 30 });
```

`storageStore` takes an [unstorage](https://unstorage.unjs.io) storage, such as Nitro's `useStorage()`, whose drivers cover Redis, Cloudflare KV and others. A store is any object with `get(key)` and `set(key, value, maxAge)`.

## One call for many keys

A list whose rows each load one thing, such as the profile of each player, makes one call per row. `batched` from `brumate/batch` turns the calls of one moment in the browser into one call with every key:

```ts
// profiles.ts
'use server';

export async function getProfiles(ids: string[]): Promise<Map<string, Profile>> {
  return new Map((await db.profiles(ids)).map((profile) => [profile.id, profile]));
}
```

```ts
// profile.ts, a plain module, since a 'use server' file exports only server functions
import { batched } from 'brumate/batch';
import { getProfiles } from './profiles.ts';

export const getProfile = batched(getProfiles, (found, id: string) => found.get(id) ?? null, {
  limit: 50,
});
```

```html
<!-- Row.brm: each row asks for one profile. -->
<script>
  const profile = $memo(getProfile(id));
</script>
```

- `batched(readMany, lookup, options)` gives a function of one key. The calls made before the next task, such as the rows of a list that the browser renders, become one call of `readMany` with every distinct key. Each call gets its value from `lookup`.
- `key` says what makes two keys the same, for keys that are objects. `limit` splits a large batch into several calls. `wait` gathers for that many milliseconds.
- A failed read rejects only the calls that it read for, and a `lookup` that throws rejects only the calls of its key.
- On the server, each call reads its own key at once. The server renders the rows of a list one after another, so their calls never happen at the same time, and calls of one key in a render still share one result. A page that renders many rows on the server reads faster with one call in the list, such as `$memo(getProfiles(ids))`, whose result it hands to the rows.
- `refresh(getProfiles)` does not load the memos that call `getProfile` again, since the compiler sees only `getProfile`. Refresh the memo of the list instead, or load the page again.
- A batched read runs a moment after it is called, outside the code that called it, so it cannot see the writes of a transaction around that code. Read many keys with one query there.
