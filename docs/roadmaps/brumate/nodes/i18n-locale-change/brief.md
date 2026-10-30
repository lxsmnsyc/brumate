---
id: i18n-locale-change
title: Parts follow a locale change of their I18nProvider
status: done
priority: should
type: fix
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
owns: []
shared:
  - .changeset/*.md
  - packages/ui/src/**
  - packages/ui/test/**
  - website/ui/i18n-provider.md
  - website/ui/demos/I18nProvider*.brm
reserves: []
provides: []
depends_on: []
---

# Parts follow a locale change of their I18nProvider

## Goal

Found by ui-docs-pages-utilities (PR #362) on 2026-10-30: an `I18nProvider` whose `locale` changes did not update the text of a Meter inside it, so the demo builds one provider per locale inside `#if`. date-field-sync (#351) made DateField, DatePicker and DateRangePicker follow a runtime locale change through memos; check every part that formats with the locale (Meter, ProgressBar, NumberField, Slider, Calendar and others) and make them follow it too.

## Acceptance

- [ ] A test changes the provider's locale and checks a Meter's text (and the other formatting parts) fails on main and passes.
- [ ] The I18nProvider demo switches the locale of one provider.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`
