# Log: prerender-defer-context

- Reproduced with a new prerendered page /team (a `$client` write to a signal, a `#defer` body that reads `CurrentUser`) and an e2e step. On the base the step failed at `.who`.
- The server answers the body request correctly ("Hello Ada"). A trace of the update `u4` showed the browser ran it right after, from `refresh` in insert.ts, which `readRecord` calls when `writes > 0`.
- Without the `$client` write, `writes` is 0 and the body keeps the server's text. That is why /about passed.
- The first test did not fail: the body arrived before the write. The fetch stub now waits for the write.
- A fixture that sets and reads a context in one component read undefined. The fixture is a parent that sets the context and a child that reads it.
- The differential suite renders every fixture in the browser too. It cannot render `#defer`, so the two fixtures are skipped there.
- First fix (filter every refresh by written slots) broke 4 resume tests; they pass alone on the base and fail alone with that change. Narrowed it to `#defer` records.
- Sizes measured with the base src rebuilt, then with the fix.
