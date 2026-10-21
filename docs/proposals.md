# Proposals

Features that would be good to add, with the reason for each, a sketch, and a rough cost. None of them is decided. [Decisions](./decisions.md) lists what is.

## Summary

| Proposal                                                                          | Area       | Value  | Cost   |
| --------------------------------------------------------------------------------- | ---------- | ------ | ------ |
| [Form actions with results](#form-actions-with-results)                           | Server     | High   | Medium |
| [Refreshing server data after an action](#refreshing-server-data-after-an-action) | Server     | High   | Medium |
| [Route error and loading files](#route-error-and-loading-files)                   | Routing    | High   | Small  |
| [Endpoints and middleware](#endpoints-and-middleware)                             | Routing    | High   | Small  |
| [Link prefetching](#link-prefetching)                                             | Navigation | High   | Small  |
| [Prerendering in the plugin](#prerendering-in-the-plugin)                         | Build      | High   | Small  |
| [Two-way binding](#two-way-binding)                                               | Syntax     | Medium | Small  |
| [Reactive logic in modules](#reactive-logic-in-modules)                           | Syntax     | High   | Large  |
| [Editor extension](#editor-extension)                                             | Tooling    | High   | Medium |
| [Devtools overlay](#devtools-overlay)                                             | Tooling    | Medium | Medium |
| [Testing helpers](#testing-helpers)                                               | Tooling    | Medium | Small  |
| [Typed routes](#typed-routes)                                                     | Routing    | Medium | Medium |
| [View transitions](#view-transitions)                                             | Navigation | Medium | Small  |
| [Layouts on static hosts](#layouts-on-static-hosts)                               | Navigation | Medium | Medium |
| [Server function streams and uploads](#server-function-streams-and-uploads)       | Server     | Medium | Medium |
| [Request forgery protection](#request-forgery-protection)                         | Security   | High   | Small  |
| [Deployment adapters](#deployment-adapters)                                       | Build      | Medium | Medium |
| [Accessibility warnings](#accessibility-warnings)                                 | Compiler   | Medium | Medium |
| [Project report](#project-report)                                                 | Tooling    | Medium | Small  |

## Server

### Server function streams and uploads

- A server function that returns an async iterable streams its values, and a memo that reads it updates with each one. seroval already streams async iterables.
- A `File` or a `Blob` argument is sent as multipart data, so uploads do not need a form.
- The call gets an `AbortSignal`, and a newer call to the same memo aborts the older one. Now an older answer is only dropped when it arrives.

## Routing

### Typed routes

The plugin knows every route and its params, so it can write their types.

```ts
import { href } from 'virtual:brumate/routes';

href('/todos/[id]', { id: '3' }); // '/todos/3'
href('/todos/[id]', {}); // Type error: `id` is missing.
```

- `params` in a route gets its type from the file path, so `$props()` needs no type argument for it.
- `brumate-tsc` checks `href` calls against the routes.

## Navigation

### View transitions

```ts
brumate({ navigate: { transition: true } });
```

- Navigation swaps the page inside `document.startViewTransition` where the browser has it, so pages can animate between each other with CSS.
- Layouts that stay are not part of the transition, unless they ask with `view-transition-name`.

### Layouts on static hosts

A prerendered page cannot start its IDs above the page in the browser, so navigation on a static host replaces the whole page and the layouts lose their state.

- The client could renumber the scopes of the new page as it reads them. The IDs are in the state, in `data-b` attributes and in marker comments, so renumbering touches only the new routes, which the client inserts anyway.
- Or the prerender step could write each page twice: once whole, and once with only its routes, starting at a fixed high base. The client asks for the second with a query.

The first needs no change to hosting, so it is the better fit.

## Syntax

### Two-way binding

Fields repeat the same pair of attributes:

```html
<input value=draft onInput=((event) => (draft = event.currentTarget.value))>
```

A `bind:` attribute writes it once:

```html
<input bind:value=draft>
<input type="checkbox" bind:checked=done>
<select bind:value=choice>…</select>
```

- `bind:value` and `bind:checked` compile to the attribute and the handler above. The handler is a client root like any other, so it loads on the first input.
- The target must be a signal, so the compiler checks the write.

### Reactive logic in modules

Reactive logic cannot leave a `.brm` file, so two components that need the same logic copy it. A module compiled with the same rules would let them share it.

```ts
// counter.brm.ts
export function counter(start: number) {
  let count = $signal(start);
  const double = $memo(count * 2);
  return {
    get count() {
      return count;
    },
    get double() {
      return double;
    },
    increment() {
      count++;
    },
  };
}
```

- The compiler inlines a call to such a function into the component, so its signals become slots of the component's scope and the graph stays static.
- The function cannot be called conditionally or in a loop, because the scope has a fixed set of slots.
- This is the largest proposal. It needs the analyzer to follow calls across files, as it already follows props.

## Tooling

### Editor extension

`@brumate/typescript-plugin` gives editors type information, but not the rest of a language: highlighting, folding, completion for compile-time functions and blocks, and diagnostics from the compiler, such as writes outside client roots.

- A TextMate grammar for highlighting, from the twinkleplop language of the website.
- A language server on Volar with the TypeScript plugin, the CSS service for styles, and the compiler's diagnostics.
- A VS Code extension that bundles both.

### Devtools overlay

A panel in development that shows what the page did:

- The scopes of the page and the values of their slots.
- Each event, the module that it loaded, and the updates that it ran.
- The graph of a component, from `inspect`, with the nodes that just updated marked.

It loads only in development, and only when it is opened, so the page it shows behaves as in production.

### Testing helpers

The tests of this repository render on the server and resume in a DOM. Apps need the same.

```ts
import { mount } from 'brumate/testing';

const page = await mount(Counter, { start: 1 });
await page.click('button');
expect(page.text('p')).toBe('Double: 4');
```

- `mount` renders on the server, puts the HTML and the state in the DOM of the test, starts the loader, and loads modules with the test runner's own import.
- It works with happy-dom and jsdom.

### Project report

`brumate inspect` describes one file. A report for the whole build would show what each route ships before and after its first event, and which components cost the most. It could fail a build that goes over a budget.

```ts
brumate({ budget: { loader: 2048, route: 10240 } });
```

## Build

### Prerendering in the plugin

The website prerenders its pages with its own script. The plugin could do it:

```ts
brumate({ prerender: ['/', '/docs'] });
```

- The plugin renders the listed paths after the build, follows links to the same origin, and writes each page as `index.html` in its folder.
- A route can opt in or out with `export const prerender = true` in its module script.

### Deployment adapters

The server runtime keeps the request with `AsyncLocalStorage`, and the example server is written for Node.

- Adapters for Node, Deno, Bun and Cloudflare Workers, each one a request handler that serves the client files and answers routes and server function calls.
- Cloudflare Workers have `AsyncLocalStorage` with the Node compatibility flag. A runtime without it could pass the request down the render instead.

## Compiler

### Accessibility warnings

The compiler sees every element and attribute, so it can warn about common mistakes:

- An image without `alt`.
- A click handler on an element that cannot get focus, such as a `<div>`, without a role and a key handler.
- A form field without a label.
- A link without text.

The warnings go through the same diagnostics as the rest, so the editor and `brumate-tsc` show them.
