---
id: ui-docs-pages-overlays
title: Anatomy, use cases, CSS and state on the pages of Overlays and layout
status: done
priority: should
type: docs
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify: pnpm --filter website check:samples && pnpm --filter website build
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns:
  - website/ui/dialog.md
  - website/ui/popover.md
  - website/ui/modal.md
  - website/ui/sheet.md
  - website/ui/tooltip.md
  - website/ui/preview-trigger.md
  - website/ui/toast.md
  - website/ui/disclosure.md
  - website/ui/disclosure-group.md
  - website/ui/breadcrumbs.md
  - website/ui/toolbar.md
  - website/ui/meter.md
  - website/ui/progress-bar.md
  - website/ui/group.md
  - website/ui/separator.md
  - website/ui/heading.md
  - website/ui/transition.md
  - website/ui/visually-hidden.md
  - website/ui/keyboard.md
  - website/ui/i18n-provider.md
  - website/ui/demos/Dialog*.brm
  - website/ui/demos/Popover*.brm
  - website/ui/demos/Modal*.brm
  - website/ui/demos/Sheet*.brm
  - website/ui/demos/Tooltip*.brm
  - website/ui/demos/PreviewTrigger*.brm
  - website/ui/demos/Toast*.brm
  - website/ui/demos/Disclosure*.brm
  - website/ui/demos/DisclosureGroup*.brm
  - website/ui/demos/Breadcrumbs*.brm
  - website/ui/demos/Toolbar*.brm
  - website/ui/demos/Meter*.brm
  - website/ui/demos/ProgressBar*.brm
  - website/ui/demos/Group*.brm
  - website/ui/demos/Separator*.brm
  - website/ui/demos/Heading*.brm
  - website/ui/demos/Transition*.brm
  - website/ui/demos/VisuallyHidden*.brm
  - website/ui/demos/Keyboard*.brm
  - website/ui/demos/I18NProvider*.brm
shared:
  - website/src/routes/ui/_layout.brm
  - website/ui/demos/Landing*.brm
reserves: []
provides: []
depends_on:
  - on: ui-docs-kit
    kind: hard
    why: it makes the anatomy and styled-example blocks and the Select page that these pages follow
---

# Anatomy, use cases, CSS and state on the pages of Overlays and layout

## Goal

Bring every page of Overlays and layout up to the pattern of the Select page from ui-docs-kit:

- an anatomy picture above the Anatomy section, with numbered callouts tied to the tag tree;
- two or three use cases that compose the part with others, such as a part in a form with validation or inside a toolbar, each a live demo with its source;
- a styled example with its complete CSS;
- a section on controlled and uncontrolled with an example of each shape that the part's state props allow, the change callbacks and form reset, linking to state.md.

## Context

- Read docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md first, and copy the Select page's structure.
- The maintainer's review on 2026-10-28 asked for these four on every part page.
- A part without state skips the controlled and uncontrolled section; a part without pieces (one element) gets no anatomy picture. Say which in the outcome.
- Check each use case against the code: claims that did not match the code were the main review finding of the earlier docs nodes.
- Style demos with the site's demo classes in website/src/routes/ui/_layout.brm; give a new demo class a name of its own (the slider and switch once shared `ui-track`).
- Never name React Aria.

## Acceptance

- [ ] Every page in owns has the four parts above, or the outcome says why one is skipped.
- [ ] Samples compile, the website builds, its tests and the /ui e2e flows pass, and axe finds no new violation on the pages.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: about a dozen pages of the same pattern.
