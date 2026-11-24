# Log: style-files-links

- 2026-11-19: worktree on feat/style-files-links. Nothing of the node existed.
- Design: `$$ctx.style(id)` (no CSS) on the server for components with CSS in a styleFiles build; hints.json gets `components` (component ID to the CSS assets of the chunk that holds its style module); the context links each asset once, in render order, in the head. Links the page has already (renderPage) are passed as `linked`.
- A render with no `<html>` has no head, so its component links go before the markup.
- After the head has gone out (`#loading` bodies), the link is written in place.
- Fix round 1: a `#defer` body dropped its component links (they went to `root.sheets`, which `renderDeferred` does not send). `style()` now returns the links in place inside a target body. Test added.
