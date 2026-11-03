# Testing server functions and routes

A component test with `mount` has no server, and a route test with `visit` needs none. This page shows how to answer server function calls in a test and how to test a route. Set up Vitest and write a first test with [Testing](./testing.md).

## Server functions

A server function that the component calls from a handler or a memo goes through `fetch`, which a test has no server for. `answerCalls()` from `virtual:brumate/testing` answers these calls in the test process, with the server code of the app. Return it from `beforeEach`, and Vitest restores `fetch` after each test:

```ts
import { beforeEach, expect, it } from 'vitest';
import { answerCalls, mount } from 'virtual:brumate/testing';
import App from '../src/App.brm?brumate-server';
import { resetTodos, todos } from '../src/db.ts';

let calls: string[] = [];

beforeEach(() => {
  resetTodos();
  calls = [];
  return answerCalls({ onCall: (id) => calls.push(id) });
});

it('saves a new todo', async () => {
  const page = await mount(App, {});
  page.input('input', 'Ship it');
  page.submit('form');

  await page.waitFor(() => expect(page.text('ul + p')).toBe('1 left'));
  expect(todos).toHaveLength(1);
  expect(calls).toHaveLength(1);
  page.unmount();
});
```

- Each call goes through `handleRequest`, as on a server. Arguments and results are serialized, `getEvent()` works, and `event.refresh` loads memos again.
- The functions are those of `virtual:brumate/server`: the functions of components and of `'use server'` files. They load on the first call.
- They share modules with the test, such as `src/db.ts` above, so the test can set up data and check what a call changed.
- `onCall` gets the ID of each call, such as `db_1a2b#addTodo`. The name of the function is after the `#`.
- Requests to other URLs go to the `fetch` from before.

### Why the test gets the server code

A DOM test gets the browser version of a file by default, so a `'use server'` file that the test imports is the stubs, which call `fetch`. The server version of a component imports the server code of `'use server'` files instead, and so does `virtual:brumate/server`. Other modules, such as `src/db.ts`, are the same copy for the test and for the server code.

`brumate/testing` exports `answerCalls(functions, options)` too, for functions of your own by ID. A server function that calls a stub throws an error that names it. Without the error, the call would answer itself through `fetch` without end.

## Routes

`visit(path)` answers a path with the routes of the app, puts the page in the document and starts the loader with client navigation. Every request of the page goes to the same routes, in the test, without a server:

```ts
import { afterEach, expect, it } from 'vitest';
import { visit } from 'virtual:brumate/testing';

let page: Awaited<ReturnType<typeof visit>> | undefined;

afterEach(() => {
  page?.close();
});

it('signs in and opens a new issue', async () => {
  page = await visit('/issues/new');
  // The middleware sent the visitor to the sign-in page.
  expect(page.url).toBe('/sign-in?next=%2Fissues%2Fnew');

  page.input('input[name=name]', 'Ada');
  page.submit('form');
  await page.waitFor(() => expect(page!.url).toBe('/issues/new'));
  expect(page.text('header .user span')).toBe('Ada');
});
```

- The page renders with its layouts and middleware, as on a server. A redirect is followed, and `url` is where it ended.
- Links use client navigation. Forms, server function calls and requests for `#defer` bodies go to the routes and to `virtual:brumate/server`.
- The cookies that the answers set are kept and sent with the next requests, so a test can sign in and go on. `cookies` has them by name.
- `visit(path, { cookies })` starts with cookies, such as those of an earlier visit. `headers` are sent with every request.
- Call `close()` at the end. It stops the loader, puts `fetch` back and empties the document. A new visit closes the one before.

| Member    | What it does                                                       |
| --------- | ------------------------------------------------------------------ |
| `url`     | The path and query of the page. It changes with client navigation. |
| `status`  | The status of the first page.                                      |
| `cookies` | The cookies that the browser has now, by name.                     |
| `close()` | Stops the loader, puts `fetch` back and empties the document.      |

`get`, `text`, `click`, `input`, `submit`, `reveal`, `waitFor` and `checkAccessibility` work as they do for `mount`, on the whole document.

Requests to other origins go to the `fetch` from before. Use `visit` or `mount` in a test, not both, since each starts a loader.

For `mount`, triggers and accessibility checks, see [Testing](./testing.md).
