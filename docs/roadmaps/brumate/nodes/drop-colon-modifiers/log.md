# Log: drop-colon-modifiers

- 2026-11-03: Nothing existed yet; the three todos fixtures and the docs were the only uses of the colon form (a git grep over the repo found no other `.brm`, website, example or sample use).
- Kept BRM022 with a new text (`Event modifiers in the attribute name were removed. Write {fix}`), removed BRM023 from the catalog (its code stays pinned in test/error-codes.json and is not reused). No new code, so BRM190 stays the last used.
- Parser fails on any `:` after an event name, before reading `=`, for elements, `<window>`, `<document>` and components. `:passive` names a plain handler.
- Removed `Modifier`, `EventAttribute.modifiers`, `printModifiers`, the warning in `readWrappers`; codegen/client.ts and markup.ts read only `site.modifiers`.
- The todos fixture now compiles `prevent(add)` into the client code, so the h5 handler entry grows (348 B to 443 B in the inspect snapshot of that fixture); snapshots updated.
- Lesson: `git stash` is shared by all worktrees. A pop took another worker's stash for a while; restored from the stash commit. Do not stash in a worker.
