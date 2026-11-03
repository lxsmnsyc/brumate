# Outcome: ui-docs-style-global

## Built

- 95 .brm files in website/ui/demos and website/src/routes/ui/_layout.brm use `<style global>` with plain selectors. `:global(` count in website/ui and website/src/routes/ui: 1510 before, 0 after.
- Unused `.ui-card*` rules removed from website/src/routes/ui/_layout.brm.
- website/ui/styling.md: the two code samples use `<style global>`; the bullet on `:global` now names `<style global>` and says a scoped `<style>` fits the elements the component writes.

## Deviations

- website/test/anatomy.test.ts (not in the shared paths) accepts `<style global>`; it failed 61 tests otherwise.
- docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md not updated (the roadmap lives in the main checkout, not on the PR branch). The pattern for later docs nodes: a demo stylesheet is `<style global>` with plain selectors.
- One PR, not split by folder: the diff is 94 near-identical demo files.

## Gotchas

- A `<style global>` rule has no scope attribute; do not mix scoped rules in the same block. A demo that needs a scoped rule keeps a second `<style>`.

## Verification

- CSS of 70 ui pages compared before and after: equal except the removed `.ui-card*` rules. Headless chromium smoke on 6 pages: no errors.
- `pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter website check:samples` (66 samples, 0 problems), `pnpm --filter website build`, `pnpm --filter website test` (271 pass): pass.

## Size

- Estimated M, actual S: a script did the rewrite.
