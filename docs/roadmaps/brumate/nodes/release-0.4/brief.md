---
id: release-0.4
title: Release brumate 0.4.0 and @brumate/ui 0.1.0
status: todo
priority: should
type: release
outline: false
milestone: 0.4.0
target: main
from: main
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/*/package.json
  - packages/*/CHANGELOG.md
reserves: []
provides: []
depends_on:
  - on: color-area-page-keys
    kind: hard
    why: in the 0.4.0 cut (a main bug found by the review of #370)
  - on: utility-demo-workarounds
    kind: hard
    why: in the 0.4.0 cut (follow-up of #362, #363, #365)
  - on: parser-closed-nesting
    kind: hard
    why: in the 0.4.0 cut (found by transition-sibling-text, #364; the maintainer, 2026-10-30)
  - on: transition-sibling-text
    kind: hard
    why: in the 0.4.0 cut (found by ui-docs-pages-utilities, #362; the maintainer, 2026-10-30)
  - on: indicator-timing-function
    kind: hard
    why: in the 0.4.0 cut (found by ui-docs-pages-utilities, #362; the maintainer, 2026-10-30)
  - on: i18n-locale-change
    kind: hard
    why: in the 0.4.0 cut (found by ui-docs-pages-utilities, #362; the maintainer, 2026-10-30)
  - on: promise-prop-memo
    kind: hard
    why: in the 0.4.0 cut (debate pending-handler-reads, 2026-10-30)
  - on: loading-header-error
    kind: hard
    why: in the 0.4.0 cut
  - on: streamed-memo-reads
    kind: hard
    why: in the 0.4.0 cut
  - on: late-state-record
    kind: hard
    why: in the 0.4.0 cut
  - on: check-package-imports
    kind: hard
    why: in the 0.4.0 cut
  - on: bind-read-your-writes
    kind: hard
    why: in the 0.4.0 cut
  - on: runtime-event-cancel
    kind: hard
    why: in the 0.4.0 cut
  - on: changeset-review
    kind: hard
    why: the changelog comes from the trimmed changesets
  - on: ui-landing-hero
    kind: hard
    why: the /ui front page ships with the first ui release
  - on: ui-docs-pages-controls
    kind: hard
    why: every /ui page complete is the ui-0.1 acceptance
  - on: ui-docs-pages-fields
    kind: hard
    why: every /ui page complete is the ui-0.1 acceptance
  - on: ui-docs-pages-forms
    kind: hard
    why: every /ui page complete is the ui-0.1 acceptance
  - on: ui-docs-pages-collections-3
    kind: hard
    why: every /ui page complete is the ui-0.1 acceptance
  - on: ui-docs-pages-collections-2
    kind: hard
    why: every /ui page complete is the ui-0.1 acceptance
  - on: ui-docs-pages-collections
    kind: hard
    why: every /ui page complete is the ui-0.1 acceptance
  - on: ui-docs-pages-utilities
    kind: hard
    why: every /ui page complete is the ui-0.1 acceptance
  - on: ui-docs-pages-layout
    kind: hard
    why: every /ui page complete is the ui-0.1 acceptance
  - on: ui-docs-pages-overlays
    kind: hard
    why: every /ui page complete is the ui-0.1 acceptance
  - on: ui-docs-pages-dates
    kind: hard
    why: every /ui page complete is the ui-0.1 acceptance
  - on: ui-docs-pages-colors-dates
    kind: hard
    why: every /ui page complete is the ui-0.1 acceptance
  - on: ui-skill
    kind: hard
    why: the skill ships inside @brumate/ui
  - on: try-sample-console
    kind: hard
    why: the website e2e suite must pass before a release
  - on: ui-scroll-focus
    kind: hard
    why: the website e2e suite must pass before a release
  - on: website-fixes
    kind: hard
    why: user-visible fixes on the site that the release links to
  - on: code-examples
    kind: hard
    why: the docs code that people copy should use the current markup
  - on: setter-ref-forward
    kind: hard
    why: a ref with a setter never gets its element, wrong behavior users can hit
  - on: ui-form-reset
    kind: hard
    why: a form reset must give every ui form part its first value in the first ui release
  - on: ui-refused-write-sync
    kind: hard
    why: a bound part must show the value its caller keeps
  - on: pending-submit
    kind: hard
    why: a pending submit must not send its form twice
  - on: children-handler-refs
    kind: hard
    why: a function used in children that render later crashes in the browser
  - on: overlay-start-open
    kind: hard
    why: an overlay with an open start value must open on load
  - on: overlay-focus-fixes
    kind: hard
    why: focus and repeat fixes the maintainer chose to ship
  - on: checkbox-description
    kind: hard
    why: a form checkbox must tie its description and error to its input
  - on: field-error-clears
    kind: hard
    why: a fixed field must clear its error
  - on: combobox-fixes
    kind: hard
    why: ComboBox, Select and Autocomplete form bugs must be fixed in the first ui release
  - on: overlay-navigation-cleanup
    kind: hard
    why: a client navigation away from an open overlay must not leave the next page inert
  - on: tokenfield-sync
    kind: hard
    why: TokenField's box must follow the kept value in the first ui release
  - on: date-field-sync
    kind: hard
    why: DateField must show the kept date, follow the locale and block an out-of-range submit
  - on: handler-code-wait
    kind: hard
    why: a handler waits on unrelated update code, and a failed load leaves effects stuck
---

# Release brumate 0.4.0 and @brumate/ui 0.1.0

## Goal

Publish brumate 0.4.0 and @brumate/ui 0.1.0 (the first public ui release), with the other packages at the versions their changesets give, and a changelog people can read.

## Context

- The maintainer asked for a formal 0.4.0 release on 2026-10-28, with @brumate/ui published as 0.1.0 at the same time. The nodes this one depends on are the cut they agreed to. Of the core fixes, setter-ref-forward and handler-code-wait are in; visible-forwarded-ref may go in if there is room; runtime-brand-checks and conditional-rest-spread wait for a later release.
- Releases run through changesets: on a push to main, .github/workflows/release.yml opens or updates a "Version Packages" pull request. Merging that pull request publishes. So this node is: check the version pull request, then hand it to the maintainer. The orchestrator never merges it (`gate: true`, and `release` is excluded from auto-merge in GOAL.md).
- @brumate/ui is at 0.0.0. Check that its changesets bump it to 0.1.0, not 0.0.1 or 1.0.0; adjust with one changeset if needed.
- Before the version pull request: `pnpm build && pnpm test && node e2e/run.mjs` pass on main (GOAL acceptance), `pnpm bench` todos size is recorded, and the package contents are checked with `pnpm pack --dry-run` for each published package (no test fixtures, the ui skill included).

## Acceptance

- [ ] The Version Packages pull request shows brumate 0.4.0 and @brumate/ui 0.1.0, and its changelogs read well.
- [ ] Build, tests, e2e and the pack check pass on main; the results are in the outcome.
- [ ] The maintainer merges the pull request and the packages are on npm.

## Sizing

S: checks and one pull request that the tooling writes.
