# Testing

`brumate/testing` renders a component on the server and resumes it in the DOM of a test, the same way a page does. A test clicks and types like a user, and checks what the user would see, with the code that ships.

## Set up

Use the brumate plugin in the Vitest config, with a DOM environment such as happy-dom:

```bash
pnpm add -D vitest happy-dom
```

```ts
// vitest.config.ts
import brumate from 'brumate/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [brumate()],
  test: { environment: 'happy-dom' },
});
```

## A first test

```ts
// test/counter.test.ts
import { expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Counter from '../src/Counter.brm?brumate-server';

it('counts', async () => {
  const page = await mount(Counter, { start: 1 });
  expect(page.text('button')).toBe('Clicked 1 times');

  page.click('button');
  await page.waitFor(() => expect(page.text('button')).toBe('Clicked 2 times'));

  page.unmount();
});
```

- `mount(component, props)` renders the component on the server, puts the HTML into the document, and starts the loader.
- The first event loads the client code of the component, as in a browser. Its effect arrives a moment later, so check it with `waitFor`.
- Call `unmount()` at the end, so the next test starts with an empty document.
- A test can mount several components, one after another or at the same time. Each mount gets scope IDs of its own, and they share one loader, as the components of a page do.

### Why `?brumate-server`

The test runs in a DOM environment, so Vite gives it the browser version of a `.brm` file by default. The browser version cannot render a page. `?brumate-server` imports the server version, which `mount` renders. The components that it renders are server versions too.

## What `mount` returns

| Member                        | What it does                                                    |
| ----------------------------- | --------------------------------------------------------------- |
| `container`                   | The element that holds the component.                           |
| `get(selector)`               | The first element that matches, or an error if none does.       |
| `text(selector)`              | The text of the first element that matches.                     |
| `click(selector)`             | Clicks an element.                                              |
| `input(selector, value)`      | Types a value into a field and fires `input`.                   |
| `submit(selector)`            | Submits a form, as its submit button does.                      |
| `waitFor(assertion, timeout)` | Retries an assertion until it passes, for 2 seconds by default. |
| `unmount()`                   | Stops the loader and removes the component.                     |

`mount` takes the options of `render` as its third argument, such as a `request` for components that read it with `getEvent()`.

## Content that streams in

A `#loading` body streams into the document when its data is ready, as on a page. Check the fallback first, then wait for the content:

```ts
it('shows the quote once it loads', async () => {
  const page = await mount(App, {});
  expect(page.container.textContent).toContain('Loading a quote');

  await page.waitFor(() => expect(page.text('blockquote')).toBe('Ship less code to the browser.'), 3000);
  page.unmount();
});
```

Pass a longer timeout to `waitFor` when the data takes a while.

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

## Type-checking tests

`brumate-tsc` checks test files with the rest of the project. Add `vitest` types if your tests use globals. See [TypeScript](./typescript.md).
