# Outcome: ui-scroll-focus

## Cause

Axe's `scrollable-region-focusable` named one node on each of /ui/calendar, /ui/list-box, /ui/grid-list and /ui/tree: the `.props-table`. The rule `.prose table` sets `display: block; overflow-x: auto`, so the table scrolled when wider than the column, and nothing in it was focusable. No part (ListBox, GridList, Tree, Calendar) and no demo scrolls, so packages/ui is unchanged.

## Fix

- `renderProps` (website/plugins/props-table.ts) wraps the table in `<div class="props-scroll" role="group" aria-label="Props" tabindex="0">`.
- website/src/styles.css: the wrapper scrolls (`overflow-x: auto`) and shows a focus ring. `.props-table` is a normal table again (`display: table`), so it keeps its table semantics.
- `role="group"` rather than `region`: pages with several tables would otherwise repeat a landmark (axe `landmark-unique`).
- e2e/suites/website.mjs: removed the `exclude: ['.props-table']` workaround of the color parts flow.
- website/test/props-table.test.ts: checks the wrapper.

## Checks

- Real Chrome (playwright-core, port 5326): the wrapper on /ui/list-box is 762px wide in 720px; focused, ArrowRight scrolls it (scrollLeft 0 to 40).
- Axe with only the rule: no node on the four pages.
- e2e `--only website --no-build`: 51 passed, 1 failed (the known /docs/control-flow "Not connected"). The sidebar flow and the color flow pass without the exclude.
- oxfmt, oxlint, brumate-tsc, website tests (114), check-samples (63 samples) and the website build pass.
- No changeset: only the private website changed.

## Review round

- Every markdown table is wrapped in `.table-scroll` and every code block `pre` gets `tabindex="0"`, `role="group"` and a label (the nearest heading, or "Table" / "Code"). `.prose table` is no longer `display: block`. Props tables are labelled `<Part> props`.
- New e2e flow: axe `scrollable-region-focusable` on every /docs and /ui page at 375px and 1280px. Zero hits.
- Contract log line added to contracts/props-table.md.
- The code cards of /ui/ and the home page (`.row-media .code`) are focusable, labelled groups. The flow also covers `/docs/` and `/ui/`.
- Inline `<code>` overflowed /docs/deploying at 375px on main too (no wrap rule). Fixed with `overflow-wrap: anywhere` on inline code in prose.
