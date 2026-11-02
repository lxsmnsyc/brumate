# Async values in markup that the browser renders

A page for `pnpm e2e --only browser-async`. Each block opens in the browser, and the test settles its promises through `window.gates`, so no case depends on timing.

```bash
pnpm --filter brumate build
pnpm --filter example-browser-async dev
```
