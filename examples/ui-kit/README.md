# UI kit example

A package of brumate components. [`examples/kit-app`](../kit-app) uses it.

- `src/Counter.brm`: a counter with a handler and a scoped style. It calls `counter` of `src/counter.brm.ts`.
- `src/Card.brm`: a card that renders `children`, and a `footer` template prop.
- `src/Greeter.brm`: a button that calls `greet` of `src/greeting.ts`, a `'use server'` file.

The package ships its `.brm` files as source. The `brumate` field of `package.json` tells the plugin of the app to compile them. See [Publishing components](../../website/docs/packages.md) for the setup.

## Tests

```bash
pnpm --filter example-ui-kit test
```
