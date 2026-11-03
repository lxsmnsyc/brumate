# Testing

`brumate/testing` renders a component on the server and resumes it in the DOM of a test, the same way a page does. A test clicks and types like a user, and checks what the user would see, with the code that ships. `visit` does the same for a route of the app, with its layouts, middleware and client navigation. See [Testing server functions and routes](./testing-server.md).

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
- The loader loads the client code of the component, as in a browser. An event before that waits for it, so its effect arrives a moment later. Check it with `waitFor`.
- Call `unmount()` at the end, so the next test starts with an empty document.
- A test can mount several components, one after another or at the same time. Each mount gets scope IDs of its own, and they share one loader, as the components of a page do.

### Why `?brumate-server`

The test runs in a DOM environment, so Vite gives it the browser version of a `.brm` file by default. The browser version cannot render a page. `?brumate-server` imports the server version, which `mount` renders. The components that it renders are server versions too.

## What `mount` returns

| Member                        | What it does                                                         |
| ----------------------------- | -------------------------------------------------------------------- |
| `container`                   | The element that holds the component.                                |
| `get(selector)`               | The first element that matches, or an error if none does.            |
| `text(selector)`              | The text of the first element that matches.                          |
| `click(selector)`             | Clicks an element.                                                   |
| `input(selector, value)`      | Types a value into a field and fires `input`.                        |
| `submit(selector)`            | Submits a form, as its submit button does.                           |
| `reveal(selector)`            | Brings elements that `offscreen` kept out of view into view.         |
| `waitFor(assertion, timeout)` | Retries an assertion until it passes, for 2 seconds by default.      |
| `checkAccessibility(options)` | Runs axe-core on the component. See [Accessibility](#accessibility). |
| `unmount()`                   | Stops the loader and removes the component.                          |

`mount` takes the options of `render` as its third argument, such as a `request` for components that read it with `getEvent()`, and `offscreen`. See [Triggers](#triggers).

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

## Triggers

The triggers of `$client`, `#client` and `#defer` fire in a test:

| Trigger     | When it fires in a test                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `'load'`    | When the loader starts.                                                                             |
| `'visible'` | At once, since `mount` and `visit` report each element that the page observes as in the viewport.   |
| `'idle'`    | A moment after the page starts. happy-dom has no `requestIdleCallback`, so the loader uses a timer. |

- Check the effect with `waitFor`, since each trigger runs after the loader starts.
- `mount` and `visit` install their own IntersectionObserver, because the one of happy-dom never reports. `unmount()` and `close()` put the observer of the environment back.
- A test needs no action for `'idle'`. It fires by itself, as it does in a browser.

To test what waits for an element, keep the element out of view with `offscreen`, a selector. The element is reported when the test calls `reveal(selector)`:

```ts
it('measures the chart when it comes into view', async () => {
  const page = await mount(Report, {}, { offscreen: '.chart' });
  expect(page.get('.chart').dataset.drawn).toBeUndefined();

  page.reveal('.chart');
  await page.waitFor(() => expect(page.get('.chart').dataset.drawn).toBe('true'));
  page.unmount();
});
```

`visit(path, { offscreen })` takes the same option.

## Accessibility

`checkAccessibility()` runs [axe-core](https://github.com/dequelabs/axe-core) on what `mount` or `visit` rendered. It throws with each violation, its element and how to fix it:

```ts
it('names the button', async () => {
  const page = await mount(IconButton, {});
  await page.checkAccessibility();
});
```

- axe-core is an optional peer dependency. Install it with `npm install --save-dev axe-core`. A test file that never calls the check does not load it, and the error without it says how to install it.
- For `mount`, the rules about a whole page, such as `landmark-one-main` and `region`, are off. For `visit` they are on. While an element with `inert` or `aria-modal="true"` is in the page, only the landmark and region rules are off, and the rules about the document, such as `document-title` and `html-has-lang`, stay on.
- The rules that need layout, such as `color-contrast`, are off, since the DOM of a test has none. Run those in an end-to-end test in a browser.
- `checkAccessibility({ rules: { 'button-name': { enabled: false } } })` turns a rule off or on by its ID.

## Type-checking tests

`brumate-tsc` checks test files with the rest of the project. Add `vitest` types if your tests use globals. See [TypeScript](./typescript.md).

To test server functions and routes, see [Testing server functions and routes](./testing-server.md).
