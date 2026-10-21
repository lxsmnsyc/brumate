# Testing

`brumate/testing` renders a component on the server and resumes it in the DOM of a test, as a page does. The HTML and the state go into the document, the loader starts, and the first event loads the client code. A test checks what a user sees, with the code that ships.

## Set up

Use the brumate plugin in the Vitest config, with a DOM environment such as happy-dom:

```ts
// vitest.config.ts
import brumate from 'brumate/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [brumate()],
  test: { environment: 'happy-dom' },
});
```

## A test

```ts
import { expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Counter from '../src/Counter.brm?brumate-server';

it('counts', async () => {
  const page = await mount(Counter, { start: 1 });
  page.click('button');
  await page.waitFor(() => expect(page.text('button')).toBe('Clicked 2 times'));
  page.unmount();
});
```

- `?brumate-server` imports the server version of a component, which `mount` renders. The components inside it are server versions too.
- `virtual:brumate/testing` gives `mount`, which loads the client modules of the project through the plugin.
- `#loading` bodies stream into the document when they are ready, as on a page.

## What `mount` returns

| Member                        | What it does                                                |
| ----------------------------- | ----------------------------------------------------------- |
| `container`                   | The element that holds the component.                       |
| `get(selector)`               | The first element that matches, or an error.                |
| `text(selector)`              | The text of the first element that matches.                 |
| `click(selector)`             | Clicks an element.                                          |
| `input(selector, value)`      | Types a value into a field and fires `input`.               |
| `submit(selector)`            | Submits a form.                                             |
| `waitFor(assertion, timeout)` | Retries an assertion until it passes, 2 seconds by default. |
| `unmount()`                   | Stops the loader and removes the component.                 |

An event loads client code the first time, so its effect arrives a moment later. Check it with `waitFor`.

`mount` takes the options of `render` as its third argument, such as `request`.

Server function calls go through `fetch`. Stub it in a test that calls one.
