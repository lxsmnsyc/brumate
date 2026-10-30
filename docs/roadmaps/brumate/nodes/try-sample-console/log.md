# Log: try-sample-console

- The failing step logged `Error: Not connected` with a stack through `App` and `status` of the sample, so the error came from the render, not from the client runtime (`fail` in client/errors.ts logs only when no `#try` catches).
- The live samples render with `server.render` in the page. `caught()` in the server runtime logs the error once when the render is not in development (`safeError`) and replaces its message. That is right for a server, so the core stays as it is.
- Fix: `runSample` passes `dev: true`. The sample then logs nothing and `#catch` shows the real message.
- Before the fix, e2e failed with the console error. After: `node e2e/run.mjs --only website --no-build` passes all 72 steps.
