# Outcome: browser-async

## Built

- `await $memo`, `#loading` and promises in markup work in markup that the browser renders, as on the server. Story PR #433 merged `feat/browser-async` into `next` on 2026-11-03, with 12 children: browser-await-spike, browser-await, browser-root-boundary, browser-try, browser-loading-fallback, promise-in-markup, topological-awaits-server, browser-await-blocks, loading-on, wait-later-memo-update, settled-memo-merge, browser-async-e2e.

## Checks

- brumate tests 2150 pass; website samples 65, 0 problems; e2e browser-async 6/6 and todos 9/9 after the sync of `next` at 0.4.4 (c71cd6a1).
- `pnpm bench --only brumate --scenario todos`, JS before `load`: `next` 13.5 kB gzip, the story 13.6 kB.

## Open calls for the maintainer

- promise-in-markup: a `#loading` body with any call in it always streams on the server.
- loading-on: about 2.4 kB gzip on a page whose first browser render is the header block, without `#offscreen`.
- browser-root-boundary: the `rootWait` flag costs about 0.6 kB gzip on every page of an app with one browser `await $memo`; limits in inbox.md.
