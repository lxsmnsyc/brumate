# Log: template-scope-leak

- Probe: `scopeLeak.brm` opens `ScopeLeakList.brm` in the browser (an `#if` shows it). Its `#for` calls the `row` template of the same file. Scope counts grew by 1 per pick (5 over 4 picks) on main.
- The suspected cause was wrong. A same-file template is a plain function that returns `raw(html, scope)`, not a `TemplateCall`, so the in-place path (`templateInserts`, `renderedTemplate`) never applies to it. Logging `write()` showed no `TemplateCall` and no new scope found at `made`.
- Real cause: the update (`fillValue`) calls `row()`, which makes a new scope, and `write()` removes the old nodes without destroying the scopes whose markup was in them.
- Fix: `destroyNodes(at, first, end)` in `scopes.ts` (the walk that `destroyRange` did, now taking a first node and an optional end), called by `write()` before it removes nodes.
- Sizes (gzip -9 of dist/client/**/*.js): todos 39256 to 39256, ui 199058 to 199050.
