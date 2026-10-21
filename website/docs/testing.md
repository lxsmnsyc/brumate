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

`mount` takes the options of `render` as its third argument, such as a `request` for components that read it with `getRequest`.

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

A server function that the component calls from a handler or a memo goes through `fetch`, which a test has no server for. Stub `fetch` so it answers the call with the functions of the component. `handleRequest` from `brumate/server` does the work, and the server version of the component exports its functions as `rpc`:

```ts
import { afterEach, expect, it, vi } from 'vitest';
import { handleRequest } from 'brumate/server';
import { mount } from 'virtual:brumate/testing';
import * as App from '../src/App.brm?brumate-server';

// The server functions of the component, by ID.
const functions = (App as unknown as { rpc: Record<string, (...args: unknown[]) => unknown> }).rpc;

afterEach(() => {
  vi.unstubAllGlobals();
});

it('saves a new todo', async () => {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(new URL(String(input), 'http://localhost'), init);
    calls.push(new URL(request.url).pathname);
    return (await handleRequest(functions, request))!;
  });

  const page = await mount(App.default, { initial: [] });
  page.input('input', 'Ship it');
  page.submit('form');

  await page.waitFor(() => expect(page.text('ul + p')).toBe('1 left'));
  await page.waitFor(() => expect(calls).toHaveLength(1));
  page.unmount();
});
```

- The functions run in the test process, so they reach the same database or mocks as the rest of the test.
- To check how the page handles an error, make the stub return an error response, or throw a `ServerError` from a mocked dependency.
- Restore `fetch` after each test with `vi.unstubAllGlobals()`.

## Type-checking tests

`brumate-tsc` checks test files with the rest of the project. Add `vitest` types if your tests use globals. See [TypeScript](./typescript.md).
