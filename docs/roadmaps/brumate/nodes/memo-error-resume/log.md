# Log: memo-error-resume

- Wrote the test first against main: a memo that always throws on the server, a handler that reads it after resume. On main the state held a rejected promise, the slot stayed a promise in the browser, and the handler read "[object Promise]", never the error. In a streamed response the same rejected promise reaches `pending().fail`, which fails the stream.
- Fix: `stateValue` (server.ts) gives a `MemoError` in place of `Promise.reject`. A memo that loads gives a promise that resolves to a `MemoError`, so the client slot becomes one when it settles and `get` throws on each read.
- `MemoError` moved from client/updates.ts to shared.ts, with `stateValues.x`, so the page state record builds it without seroval. The serial plugin `brumate/memo-error` writes `$b.x(<error>)`.
- A first try tested `instanceof MemoError` in the plugin. After `vi.resetModules()` the compiled page and serial.ts hold different copies of the class, so the test failed ("cannot be parsed"). The server now marks the instance with `Symbol.for('brumate.held')`, as slots use `brumate.slot`. The mark is only on the server, so the client pays nothing.
- Dev flag: `Context.isDev()` reads `development`, set from `RenderOptions.dev` on the root context.
- The codegen cannot tell that a memo fails on the server, so the client code cannot be split by page. The cost is the `x` entry of `stateValues` and the class move: +36 B gzip on todos (28883 to 28919, all JS of benchmarks/brumate/dist).
- `pnpm bench` and the browser metric need the server build, which does not exist in the worktree; the sum of gzip -9 of all JS in dist is the figure.
- Full ui suite: 1 failure, test/generics-markup.test.ts, which fails on main too (checked in a base worktree).
