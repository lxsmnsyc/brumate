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
- `event.refresh(fn)` works with the functions of a file too. Memos of components that call `fn` from the file load again.

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

## Request locals

Middleware hands what it finds, such as the user, to the rest of the request through `event.locals`. Components, server functions and endpoints read it with `getEvent().locals`:

```ts
// src/middleware.ts
import { defineMiddleware } from 'brumate/server';

export default defineMiddleware(async (event, next) => {
  event.locals.user = await readUser(event);
  return next();
});
```

```ts
async function listOrders() {
  'use server';
  const { user } = getEvent().locals;
  return user ? db.orders.of(user.id) : [];
}
```

Its type comes from the `Locals` interface of `brumate/server`, which the app adds to:

```ts
// src/locals.d.ts
declare module 'brumate/server' {
  interface Locals {
    user?: { id: string; name: string; admin: boolean };
  }
}
```

- It never goes to the browser. A component that sends a value from it, such as the user's name, reads the field it needs, as it does with any server value.
- `event.waitUntil(promise)` keeps work going after the response ends, such as a log line or analytics. On a host that stops a function when its response ends, such as Cloudflare Workers, pass the host's `waitUntil` in the options of `handle`, and the promise goes to it. Elsewhere the promise runs on its own, and its error is logged.

See [Middleware](./routing.md#middleware).

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

export const session = createSession<{ userId: string }>({
  secret: process.env.SESSION_SECRET!,
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

## Refreshing data

A memo that calls a server function loads again when the values it reads change. When another server function changes the data, call `event.refresh` with the function that reads it. Every memo on the page that calls that function loads again.

```brm live
<script module>
  // Kept in memory for the sample. A real app would use a database.
  const names: string[] = ['Ada'];
</script>

<script>
  import { $memo, $signal } from 'brumate/signals';
  import { getEvent } from 'brumate/server';

  async function list() {
    'use server';
    return [...names];
  }

  async function add(name: string) {
    'use server';
    names.push(name);
    getEvent().refresh(list);
  }

  const people = $memo(list());
  let draft = $signal('');
</script>

<input aria-label="Name" value=draft onInput=((event) => (draft = event.currentTarget.value))>
<button onClick=(() => add(draft))>Add</button>
<ul>
  #for (person of people by person) {
    <li>{person}</li>
  }
</ul>
```

- `event.refresh` takes a server function of the same component, or a function of a `'use server'` file.
- The memos load again in every component on the page that calls the function.

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

## Rate limiting

Server functions are public endpoints: anyone can call them with `fetch`, as often as they like. A sign-in, a search or a form that sends mail needs a limit. `rateLimit` counts the calls of each client and refuses the ones over the limit:

```ts
import { rateLimit } from 'brumate/server';

async function signIn(name: string, password: string) {
  'use server';
  await rateLimit({ max: 5, window: '1m' });
  // …
}
```

- Call it first thing in the function, before its first `await`, as `getEvent()`. After `max` calls in the window from one key, a call rejects with a `RateLimitError`: status 429, `Retry-After`, and the seconds to wait in `retryAfter`, in the browser too. The rest of the function does not run.
- The key defaults to the address of the client and the ID of the function, so each function has its own count. `key: (event) => …` counts by something else, such as the user of the session, wherever they sign in from.
- The window is a length such as `'10s'`, `'1m'` or `'1h'`, or a number of milliseconds. The count slides: it weighs the last window by how much of it is still inside the window, so a burst at the edge of a window does not get through.
- `rateLimit.strict`, 3 calls in 10 seconds, is a preset for functions that guess at secrets, such as a sign-in or a code check: `await rateLimit(rateLimit.strict)`.
- `rateLimit.middleware({ max, window })` limits every request under a folder of routes, endpoints and pages included, as its `_middleware.ts`, or every request of the app as the entry middleware. A request over the limit answers 429 with the message.
- Limits are off outside production, so a reload while working does not lock anyone out. `configureRateLimit({ enabled: true })` turns them on, or `enabled` on one limit.
- The counts live in memory, per process. An app with more than one server passes a store to `configureRateLimit({ store })`, or to one limit, with `increment(key, ttl)` and `get(key)`, such as `INCR` with `EXPIRE` on Redis.

The address of the client comes from the server. A server passes it to `handle` as `address`, such as the remote address of the socket. Behind a proxy, the address the server sees is the proxy's, and the client's is in `X-Forwarded-For`. The header is read only from proxies that the app names, as addresses or CIDR ranges, and from the right, past them, because a client can write anything at its left:

```ts
import { configureRateLimit } from 'brumate/server';

configureRateLimit({ proxies: ['10.0.0.0/8'] });
```

`clientAddress(event)` gives the address that the limits use. An IPv6 address counts by its /64, since one client often holds a whole subnet. Without a known address, the limits warn once and count every such caller in one bucket, rather than not limiting at all. See [Deploying](./deploying.md) for passing the address.

## Calls from other sites

A call carries the cookies of the user, so the server refuses calls from pages of other sites with status 403. To allow another origin of your own, such as an admin app on another domain, list it in the plugin options:

```ts
brumate({ origins: ['https://admin.example.com'] });
```

[Security](./reference-security.md) describes the check.
