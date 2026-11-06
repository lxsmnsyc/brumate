# Log: template-scope-leak

- Probe: `scopeLeak.brm` opens `ScopeLeakList.brm` in the browser (an `#if` shows it). Its `#for` calls the `row` template of the same file. Scope counts grew by 1 per pick (5 over 4 picks) on main.
- The suspected cause was wrong. A same-file template is a plain function that returns `raw(html, scope)`, not a `TemplateCall`, so the in-place path (`templateInserts`, `renderedTemplate`) never applies to it. Logging `write()` showed no `TemplateCall` and no new scope found at `made`.
- Real cause: the update (`fillValue`) calls `row()`, which makes a new scope, and `write()` removes the old nodes without destroying the scopes whose markup was in them.
- Fix: `destroyNodes(at, first, end)` in `scopes.ts` (the walk that `destroyRange` did, now taking a first node and an optional end), called by `write()` before it removes nodes.
- Sizes (gzip -9 of dist/client/**/*.js): todos 39256 to 39237, ui 199058 to 199046 (the destroy is gated on HAS_CHILDREN or HAS_TEMPLATES).

## Review fixes

- The gate `HAS_CHILDREN || HAS_TEMPLATES` left the fix out of real builds: a component whose only scoped inserts come from a template of its own file set neither flag, since `templates` looked only for `export ... tN`. `getFeatures` now also sets `templates` for `$$b.raw($$html, <scope>)`, the return of a template with a scope. Test in feature-flags.test.ts; it fails without the change.
- The leak test fails against origin/main's inserts.ts (checked by copying the file in, not by stash).
- A cleanup-runs test needs a component inside the template. That fails on main for another reason: the browser's update part calls the template but does not import the component (`ScopeLeakItem is not defined`). Filed as its own 0.6.1 node; the cleanup test goes with that fix.
- Sizes after the review fix: todos 39,244 B, ui 199,051 B gzip.
