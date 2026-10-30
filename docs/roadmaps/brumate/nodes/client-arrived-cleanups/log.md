# Log

- Unit test (packages/brumate/test/resume.test.ts, "a page that arrived by client navigation"): layout with a kept shell, link to a route with an `$effect` and a `$client` that return cleanups, click to start the core there, link to a third route. Both cleanups run, with and without the core started on the first page. It passes on main.
- Chrome probe on the built website (patched dist to log scope removals): /ui/switch -> client link -> /ui/modal -> open -> Back. Main: the modal scope is removed on Back with 1 cleanup, so the cleanup runs. With the three overlay files of #355 applied: 0 layers, 0 inert nodes, no scroll lock after Back. Variants tried: warm core on the first page, no waits, Back right after open.
- Could not reproduce the report from #355 (cleanups of a client-arrived page not running). No core change made.
- Difference worth knowing: on a partial route replace, the old route's markup is removed first and its cleanups run after, when the next state record is read (`dropScopes`). A full replace runs `leavePage` before the markup goes. A cleanup that checks `isConnected` sees different answers on the two paths.
