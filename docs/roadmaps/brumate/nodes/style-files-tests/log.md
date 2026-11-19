# Log: style-files-tests

- 2026-11-19: the build test (no `$$css`, assets in hints, `<style>` and links in pages) and the PostCSS tests already existed from modules, links, inline and postcss.
- The gap was `liveBlocks` variables with linked CSS: added a describe in `block-styles-live.test.ts` that compiles with `styleFiles` and checks resume, keyed reorder and a row the browser adds, with no `<style>` added to the head.
- `website/docs/styles.md` "On the page" now covers assets per bundle, the two copies, non-blocking sheets, navigation and `#defer` waits, dev.
- One changeset for the story: `.changeset/style-files.md` (minor). No earlier style-files changeset existed to merge.
- The story brief has no Acceptance section; the table in the outcome checks its Goal and Why items.
