# @brumate/ui example

A page of every part of [`@brumate/ui`](../../packages/ui), with the styles of the page only. `pnpm e2e --only ui` builds it, checks each part in Chrome, and checks the page with axe-core.

```bash
pnpm --filter brumate build
pnpm --filter example-ui dev
```

The workbench of the parts is at `/__brumate/workbench` of the dev server.
