# Scripts of other sites

A page for `pnpm e2e --only scripts`. Its scripts load files of `https://third-party.test`, which the test answers, so it reads the requests and the globals that the files set.

```bash
pnpm --filter brumate build
pnpm --filter example-external-scripts dev
```
