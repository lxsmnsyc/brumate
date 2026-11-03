# Log: ui-docs-style-global

- Branch docs/ui-docs-style-global from origin/next 4c51ee7a, worktree .claude/worktrees/ui-docs-style-global. One PR (about 1600 changed lines, all mechanical).
- Baseline `:global(` count: 1510 in 96 files (95 .brm + website/ui/styling.md, whose count covers 4 uses). After: 0 in website/ui and website/src/routes/ui.
- Script (scratchpad): parses each `<style>` of a file, classifies each top-level rule as all-global or scoped, and for blocks with no scoped rule changes `<style>` to `<style global>` and unwraps `:global(X)` to `X`. No block had a scoped rule, so no file was split. `@keyframes` and `@media` blocks moved with their block.
- Removed the unused `.ui-card*` rules (12 rules) from website/src/routes/ui/_layout.brm.
- Proof: built website/dist/client before and after; compared the CSS in every `<style>` of the 70 prerendered ui pages as a multiset of (at-rule context, selector, sorted declarations), scope hash stripped. The only difference on all 70 pages: the 12 removed `.ui-card*` selectors. The count of `[b-c-...]` scope attributes in the ui pages is 10974 before and after, so no rule changed from scoped to global.
- Headless chromium (playwright-core, preview on port 4190, stopped after): /ui/button, dialog, checkbox, table, tabs, color-picker load with no console errors; .ui-demo border and .ui-button padding and radius as expected.
- website/test/anatomy.test.ts asserted `<style>` in each styled demo; it now accepts `<style global>`.
