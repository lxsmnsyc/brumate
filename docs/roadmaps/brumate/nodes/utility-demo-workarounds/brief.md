---
id: utility-demo-workarounds
title: The utility part demos drop the workarounds for bugs fixed since
status: done
priority: should
type: docs
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
owns:
  - website/ui/demos/I18nProviderLocaleDemo.brm
  - website/ui/demos/SelectionIndicatorToggleDemo.brm
shared:
  - website/ui/i18n-provider.md
  - website/ui/selection-indicator.md
  - website/ui/demos/I18nProviderDemo.brm
  - e2e/suites/website.mjs
reserves: []
provides: []
depends_on:
  - on: ui-docs-pages-utilities
    kind: hard
    why: the demos come from #362
  - on: i18n-locale-change
    kind: hard
    why: #365 makes NumberField and ColorField follow a locale change
  - on: indicator-timing-function
    kind: hard
    why: #363 accepts timing functions with commas
---

# The utility part demos drop the workarounds for bugs fixed since

## Goal

PR #362 worked around three bugs in its demos. Two are fixed on main now:

- website/ui/demos/I18nProviderLocaleDemo.brm builds one `I18nProvider` per locale inside an `#if`, and website/ui/i18n-provider.md ("A locale switch") says so. Since #365 the parts follow a locale change of one provider. #365 also changed I18nProviderDemo.brm to switch the locale of one provider, so the page may now show two locale switches: keep one clear example (merge or drop the duplicate) and fix the text.
- website/ui/demos/SelectionIndicatorToggleDemo.brm uses `transition-timing-function: ease-out`. Since #363 a timing function with commas works: use the site's `cubic-bezier(...)` value (see the `.ui-indicator` rule in website/src/routes/ui/_layout.brm) if it reads better, or keep `ease-out` and say nothing.

The third, text wrapped in `<span>` beside a Transition (TransitionStyled.brm), is valid HTML and stays: a `<div>` inside a `<p>` is invalid (see nodes/transition-sibling-text/outcome.md).

## Acceptance

- [ ] The I18nProvider page shows a locale switch with one provider, and no text mentions the `#if` workaround.
- [ ] The website e2e flow for the utility pages passes (it visits `i18n-provider`), and switching the locale in the demo changes the Meter's format in Chrome.
- [ ] `pnpm --filter website check:samples && pnpm --filter website build` pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: two demos and a paragraph.
