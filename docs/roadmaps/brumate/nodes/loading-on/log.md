# Log: loading-on

- 2026-11-02: started from feat/browser-async 01017a8e. Read the brief, the loading-reload debate, the client-pending-boundary contract (v1.2) and the outcomes of loading-header-error, streamed-memo-reads and browser-loading-fallback.
- First test (debate open risk): a `#loading (user)` body that the server streamed in. The body renders between `<!--b{scope}:{anchor}:1-->` and `<!--/b-->` with a scope of its own, so the client finds it and `hiding.hide(body, start, end)` hides it. Clicking Next starts a browser load, `#else` shows after the body, then the same `<p>` and `<input>` (with its typed value) show again. It passes, and fails with `held` returning at once. Went on.
- `$isPending(m)` in markup outside `#loading` makes the server wait for `m` (blockingMemos counts its read). The header must not, so `isLoadingHeader` skips header reads in `blockingMemos` and `awaitedMemos`.
- The hold is `held(scope, anchor, pending, kind, render, kinds)` in branches.ts next to `offscreen`, not in the `loading` closure of waits.ts. A resumed body has no closure. An update of the parent scope runs the header for a streamed body and for a browser-rendered one alike. The `loading` closure is untouched. While its first fallback shows, the body has no markers in the page, and `held` does nothing.
- Effects in a resumed body run again only after a write (the server ran them), so the pause test bumps first.
- Full suite under load (load average above 70, other workers): beforeAll hooks of render/resume and some CLI tests time out. Alone they pass.
