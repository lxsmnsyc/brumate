# Todos example

A todo list and a counter, rendered on the server and resumed in the browser.

```bash
pnpm --filter brumate build
pnpm --filter example-todos dev
```

Open the page and the network panel. Only the loader runs before the first click. The first click loads `brumate/client` and the module of the component that was clicked.
