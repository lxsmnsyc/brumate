# Kit app example

An app that renders the components of [`examples/ui-kit`](../ui-kit), a package of components.

- `src/routes/index.brm` imports `example-ui-kit/Counter.brm`, `example-ui-kit/Card.brm`, `example-ui-kit/Greeter.brm` and `example-ui-kit/counter.brm.ts`.
- It passes a signal to a prop of the counter, so the counter updates when the app changes it.
- The greeter calls a server function of the kit, which the server of the app answers.

## Development

```bash
pnpm --filter brumate build
pnpm --filter example-kit-app dev
```

An edit of a file of the kit updates the page, as an edit of a file of the app does.

## Production

```bash
pnpm --filter brumate build
pnpm --filter example-kit-app build
pnpm --filter example-kit-app start
```

## Tests

```bash
pnpm --filter example-kit-app test
```
