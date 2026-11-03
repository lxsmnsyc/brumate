---
id: ui-docs-style-global
title: The ui docs and demos style with <style global> instead of :global on every selector
status: done
priority: should
type: docs
outline: false
milestone: 0.6.0
target:
from:
size: M
spike: false
verify: pnpm --filter website check:samples && pnpm --filter website build
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
spent: 89000
owns: []
shared:
  - website/ui/**
  - website/src/routes/ui/**
  - website/ui/styling.md
  - docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md
reserves: []
provides: []
depends_on:
  - on: style-global
    kind: hard
    why: it adds <style global>
---

# The ui docs and demos style with <style global> instead of :global on every selector

## Goal

The styling sections and the styled demos of @brumate/ui, and the demo styles in website/src/routes/ui/_layout.brm, use `<style global>` for their part rules instead of wrapping every selector in `:global(...)`. The CSS a reader copies is plain CSS.

## Context

- Planned for the 0.5.0 release, not 0.4.0 (the maintainer, 2026-10-28).
- Asked by the maintainer on 2026-10-28. On 2026-11-03 (re-checked): 1510 `:global(...)` across 96 files in website/ui and website/src/routes/ui; no `<style global>` is used in website/ yet. `<style global>` landed in #443 (website/docs/styles.md, Global blocks).
- styling.md explains `:global` once; replace that with `<style global>`, and say when a scoped style is still the better choice.
- Update the pattern in docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md so later docs nodes write `<style global>`.
- The ui-docs-pages nodes have landed. ui-preview-center edits the same `_layout.brm` rules: land it first, or rebase on it. Split the work into a few PRs by folder if one diff gets too large to review. ui-gallery-from-groups (#454) left the `:global(.ui-card*)` rules in `_layout.brm` unused; remove them here.
- The look must not change: compare screenshots of a few pages before and after.

## Acceptance

- [ ] No `:global(` left in website/ui or website/src/routes/ui where a `<style global>` block fits; any left has a reason.
- [ ] Samples compile, the website builds, its tests and e2e pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: a mechanical rewrite across many demo files, checked by screenshots.
