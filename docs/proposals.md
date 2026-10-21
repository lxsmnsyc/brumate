# Proposals

Features that would be good to add, with the reason for each, a sketch, and a rough cost. None of them is decided. [Decisions](./decisions.md) lists what is.

## Summary

| Proposal                                                              | Area    | Value  | Cost   |
| --------------------------------------------------------------------- | ------- | ------ | ------ |
| [Two-way binding](#two-way-binding)                                   | Syntax  | Medium | Small  |
| [Reactive logic in modules](#reactive-logic-in-modules)               | Syntax  | High   | Large  |
| [Content mappers for TypeScript 7](#content-mappers-for-typescript-7) | Tooling | High   | Medium |
| [Deployment adapters](#deployment-adapters)                           | Build   | Medium | Medium |

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

### Content mappers for TypeScript 7

TypeScript 7 does not load plugins, so `.brm` files get types only from TypeScript 6 and older, through `@brumate/tsc` and `@brumate/typescript-plugin`. TypeScript 7.1 adds an API for content mappers, which turn the files of other languages into TypeScript and map positions between them.

- A content mapper from `toTypeScript` would let `tsc` and the editor of TypeScript 7 check `.brm` files.
- It would replace `@brumate/tsc`, and the TypeScript plugin in the extension.
- This waits for the API to be stable, and for its documentation.

## Build

### Deployment adapters

The server runtime keeps the request with `AsyncLocalStorage`, and the example server is written for Node.

- Adapters for Node, Deno, Bun and Cloudflare Workers, each one a request handler that serves the client files and answers routes and server function calls.
- Cloudflare Workers have `AsyncLocalStorage` with the Node compatibility flag. A runtime without it could pass the request down the render instead.
