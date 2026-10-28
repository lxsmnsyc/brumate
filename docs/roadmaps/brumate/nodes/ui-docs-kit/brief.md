---
id: ui-docs-kit
title: Anatomy pictures, styled examples and the state and styling guides for the ui docs
status: active
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
  - website/src/components/Anatomy*.brm
  - website/src/components/StyledExample*.brm
  - website/ui/styling.md
  - website/ui/state.md
  - website/ui/select.md
  - website/ui/demos/Select*.brm
shared:
  - website/plugins/markdown.ts
  - website/src/routes/ui/_layout.brm
  - website/src/ui.ts
  - website/src/styles.css
  - e2e/suites/website.mjs
reserves: []
provides: []
depends_on: []
---

# Anatomy pictures, styled examples and the state and styling guides for the ui docs

## Goal

Give the ui docs the tools that the four family nodes (ui-docs-pages-*) use on every page, and finish one page, Select, as the pattern:

1. **Anatomy picture.** A block in the markdown (for example a fence or a demo option) that renders the part live and puts numbered callouts on each of its pieces (the Label, the Button, the value, the Popover, an item), with a numbered list of the pieces below it that matches the tag tree of the page's Anatomy section. The maintainer approved this form on 2026-10-28: the rendered part with numbered labels on each piece, tied to the tag list.
2. **Styled example.** A block that shows a part styled with a complete stylesheet (states, focus, disabled, invalid, open), the live result next to it, and the CSS as text. Terracotta's docs are the model for the depth of the CSS examples.
3. **styling.md.** Rewrite it around full examples: a styled part per kind (a button, a field, a collection, an overlay), styling by state with the data attributes, transitions, and dark mode, each with its CSS.
4. **state.md.** Flesh out controlled and uncontrolled: each shape (own state, own copy that starts from a prop, `$bind` to your signal, `$bind` with a setter that asks you) with a live example and when to use it, the change callbacks, form reset, the server render, and a table of the state props of every part.
5. **Select page.** Use all of it on website/ui/select.md: the anatomy picture, two or three use cases that compose parts (for example a Select in a form with validation, a Select with sections and descriptions, a Select whose list loads from the server), a styled example, and a section on controlled and uncontrolled with examples.

## Context

- The maintainer's review on 2026-10-28: the part pages lack an anatomy visual, use cases where composition is shown, CSS examples in styling, and a real treatment of controlled and uncontrolled.
- 49 pages have an Anatomy section as a tag tree in an `html` fence. The picture must not replace it; it sits above it.
- Live demos are .brm files in website/ui/demos, compiled by the website build; `check:samples` covers `brm live` fences. Follow how the props-table contract (contracts/props-table.md) and docs-generator added a fence.
- Callouts must work in light and dark, at phone width, and with a screen reader (the numbers are text, the picture has a label). The live part inside the picture is inert so the callouts stay put.
- Never name React Aria. Terracotta is the maintainer's own library and can be named.
- Write the pattern down in docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md, so the family nodes follow it.

## Acceptance

- [ ] The anatomy block and the styled-example block exist, are documented for page authors, and render on the Select page in light and dark and at phone width, with no axe violations.
- [ ] styling.md and state.md have the content above, with live examples.
- [ ] Samples compile, the website builds, its tests and the /ui e2e flows pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: two blocks, two guides and one page.
