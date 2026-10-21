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
- `refresh(fn)` works with the functions of a file too. Memos of components that call `fn` from the file load again.

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
- Its arguments come from the browser, so treat them as untrusted input. Check them before you use them.

Capturing an instance variable is a compile error that names the variable:

```
Server function "save" captures "user" (Todos.brm:6:3). Pass it as an argument.
```

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

`brumate/server` gives a server function the request of the call, and a way to change the response:

```ts
import { ServerError, getRequest, getResponseHeaders, redirect } from 'brumate/server';

async function login(name: string) {
  'use server';
  const agent = getRequest().headers.get('user-agent');
  if (name === 'admin') {
    redirect('/admin');
  }
  getResponseHeaders().set('set-cookie', `user=${name}; HttpOnly; Path=/`);
  return `Hello ${name}`;
}
```

- `getRequest()` returns the web `Request` of the call, with its headers and cookies.
- `getResponseHeaders()` returns headers to add to the response, such as `set-cookie`.
- `redirect(location)` stops the function, and the browser goes to `location`.

The same functions work in the setup code of a component while a page renders. There, `setStatus(404)` also sets the status of the page. See [Routing](./routing.md#errors-and-404).

When the browser no longer needs an answer, such as a memo whose input changed again, it aborts the call. `getRequest().signal` tells the function, so it can stop work it no longer needs:

```ts
async function search(query: string) {
  'use server';
  return db.products.search(query, { signal: getRequest().signal });
}
```

## Cookies and sessions

`getCookie` and `setCookie` read the cookies of the request and set them on the response:

```ts
import { getCookie, setCookie } from 'brumate/server';

async function chooseTheme(theme: 'light' | 'dark') {
  'use server';
  setCookie('theme', theme, { maxAge: 60 * 60 * 24 * 365 });
}

async function currentTheme() {
  'use server';
  return getCookie('theme') ?? 'light';
}
```

- A cookie is `HttpOnly`, `SameSite=Lax` and on the path `/`, unless the options say otherwise, and `Secure` on HTTPS. `deleteCookie(name)` deletes one.
- They work in server functions, in middleware and endpoints, and while a page renders its first part. Markup that streams later, such as a `#loading` body, cannot set cookies, because the response has started.
- After `setCookie`, `getCookie` in the same request reads the new value.

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

import { redirect } from 'brumate/server';
import { session } from './session.ts';

export async function login(form: FormData) {
  const user = await checkPassword(String(form.get('email')), String(form.get('password')));
  await session.set({ userId: user.id });
  redirect('/');
}

export async function logout() {
  session.clear();
  redirect('/login');
}

export async function currentUser() {
  const data = await session.get();
  return data && findUser(data.userId);
}
```

- `get()` returns undefined when there is no session, when it expired, or when its signature does not match, such as after a browser changed it.
- `set(data)` replaces the data and starts its time again. `update(change)` changes some fields. `clear()` ends the session.
- The secret is at least 32 characters, kept out of the code. A list of secrets signs with the first and accepts all of them, so a secret can change without ending every session.
- Sessions last 7 days unless `maxAge` says otherwise, in seconds.
- The browser can read the data, but cannot change it. Keep secrets out of it: store an ID, and look the rest up on the server. A cookie holds about 4 KB.

A custom Node server sends the cookies with `toNodeHeaders(answer.headers)`, which keeps each one apart. See [Deploying](./deploying.md).

## Refreshing data

A memo that calls a server function loads again when the values it reads change. When another server function changes the data, call `refresh` with the function that reads it. Every memo on the page that calls that function loads again.

```brm live
<script module>
  // Kept in memory for the sample. A real app would use a database.
  const names: string[] = ['Ada'];
</script>

<script>
  import { $memo, $signal } from 'brumate/signals';
  import { refresh } from 'brumate/server';

  async function list() {
    'use server';
    return [...names];
  }

  async function add(name: string) {
    'use server';
    names.push(name);
    refresh(list);
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

- `refresh` takes a server function of the same component, or a function of a `'use server'` file.
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

## Calls from other sites

A call carries the cookies of the user, so the server refuses calls from pages of other sites with status 403. To allow another origin of your own, such as an admin app on another domain, list it in the plugin options:

```ts
brumate({ origins: ['https://admin.example.com'] });
```

[Security](./reference-security.md) describes the check.
