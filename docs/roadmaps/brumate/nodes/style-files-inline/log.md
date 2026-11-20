# Log: style-files-inline

- Read the FCP review: the blocking cause is the 3 or 4 bundle `<link rel=stylesheet>` the route writes in the head after the preload links, not the component links alone.
- Design: the client build writes the CSS text of each component with a style module into `hints.json` (`css`), `virtual:brumate/client-bundles` passes it to `setClientBundles`, and `Context.style(id)` writes `<style b-style>` in the head (in place after the head, and in a `#defer` body). Server build only; no client chunk holds it.
- The bundle sheets of a first load are `<link rel=preload as=style b-sheet>`; `boot.ts` (`applySheets`) turns them into stylesheets at `load`, or removes one the loader linked already. A navigation request (`x-brumate-base`) still gets plain stylesheet links, so the swap waits for them.
- The first e2e run failed ("a visit that a newer one replaced"): the e2e website server is the prerendered static HTML, which ignores the request header, so a navigation fetched the first-load form (preload links), did not wait, and the loader linked the sheets after the swap (an unstyled frame on static hosts). Fix: `linkPreloads` in `sheets.ts`, called on the parsed page in `navigate.ts`. A gap on a common path, fixed here.
- The "waits for the stylesheets of the next page" e2e step crashed on `route.continue: Route is already handled` once the home page applied its sheets late; it now waits for the home sheets to apply first and tolerates a handled route, as the next step already did.
- `updateHead` identifies `<style b-style>` by component ID, so a nonce does not make it new on each navigation.
- Measured with the throttled harness against `f5cd683b`: see `reviews/style-files-fcp.md`, round 2. The `ui` overlay e2e step "Escape left the tooltip" failed once under load 8 to 9 and passed alone: load noise.

## Fix round 1 (fresh review)

- Inline text from the pipeline: each style module ends with a mark rule (`.b-mark-<hash>{--b-mark:<mark>}`). In `writeBundle` the build cuts the marks out of the sheets (rewrites the files) and keeps the text between two marks as the component's inline CSS, so it is the sheet's own text after urls, `@import`, PostCSS and the minifier. The first version (`minifyCSS` of the raw compile) would have served `url(./bg.png)`.
- A sheet loads late only when its chunk has no CSS module other than style modules, every mark was found, and the chunk has one sheet; the table is `deferred` in hints.json (sheet URL to the components with global rules). The server preloads the sheet only when the page wrote the CSS of each of those components; otherwise a plain blocking link. This also covers item 3 (globals of components the page does not render keep their sheet blocking). A `<noscript>` link follows each preload.
- `updateHead` keeps head `<style b-style>` on a route replacement, and `pruneSheets` removes those whose scopes no element uses (styles without scopes stay).
- Converted links lose `as` and `b-sheet`; `linkPreloads` also drops the `noscript[b-sheet]` of a fetched page.
- e2e: the route handler ignores only "already handled".
- Slow 4G re-run: see the review file.

## Fix round 2

- `cutMarks` runs in `generateBundle` and sets `asset.source`, so Rollup writes clean sheets and later plugins see them; the disk rewrite in `writeBundle` is gone.
- A sheet is cut only when its marks are all there and in the order of the chunk's style modules; otherwise the marks still leave the sheet, its components get no inline CSS and the sheet stays a blocking link.
- Marks are keyed by the hash of the full module path.
- Tests: the sheets a later plugin sees have no marks; builds with a missing and a reordered mark fall back to blocking links with no mark in the output.
