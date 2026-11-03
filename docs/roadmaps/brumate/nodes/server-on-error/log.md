# Log: server-on-error

- 2026-11-03: Nothing existed. Name `onError` fits beside the planned `onTrace` (proposals, Observability).
- Hook lives in a module variable of server.ts, set by handleRequest and handleRoute from `options.onError`. `logError(error, kind, event)` replaces the `console.error` calls; `failures.report` in request.ts covers the `waitUntil` log.
- Plugin: regex on the source of the entry middleware finds `export ... onError`; the server registry, route module and testing module import it then.
- Branch feat/server-on-error, PR #439 (draft). Bench todos: 13.6 kB gzip before load.
