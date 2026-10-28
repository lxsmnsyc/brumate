---
id: ui-landing-hero
title: The /ui landing page in the style of the brumate home page
status: done
priority: should
type: docs
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify: pnpm --filter website check:samples
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns:
  - website/src/routes/ui/index.brm
  - website/src/components/UiLanding*.brm
shared:
  - .changeset/*.md
  - website/ui/index.md
  - website/ui/demos/Landing*.brm
  - website/src/routes/ui/_layout.brm
  - website/src/ui.ts
  - website/src/styles/**
  - e2e/suites/website.mjs
reserves: []
provides: []
depends_on:
  - on: ui-landing
    kind: hard
    why: it reworks the page that ui-landing made
---

# The /ui landing page in the style of the brumate home page

## Goal

/ui opens on a marketing page like the brumate home page (website/src/routes/index.brm), not a docs page in the sidebar shell: a hero with the name, a one-line pitch, calls to action (Get started, All parts) and the install command; visuals that show what the parts do; and sections that make the case, each with a picture or a live part beside the text.

## Context

- The maintainer, on 2026-10-28, after seeing ui-landing (#316): "this isn't really what I had in mind. I'm thinking more of what brumate already has (hero section, visuals, the usual stuff)".
- Follow the home page's layout, components and styles: Header, the hero, the buttons, the install line, the sections with a visual (ShipsMap, BusyStrips, Network, Shipped). Reuse its CSS and components rather than copying them; if a component needs a prop to fit, add it.
- Content to keep from ui-landing: live parts people can use (a showcase of several parts, styled like the site), unstyled with data attributes, accessible (keyboard, screen readers, one press for mouse, touch, pen), resumable, works without scripts, and the measured sizes (website/scripts/measure-ui-sizes.mjs; JS only, gzip, first server render). Show the sizes as a visual, not only a table.
- The introduction stays at /ui/introduction and the grid at /ui/parts. The landing page has no docs sidebar, like the home page; keep the header with search.
- Never name React Aria. Link to the design influences page.
- Run e2e with `node e2e/run.mjs --only website --no-build` in a worktree after building the packages and the website by hand. The flows for /ui (header link, sidebar pages) may need updating. Two flows fail on main already (try-sample-console, ui-scroll-focus); do not fix them here.

## Acceptance

- [ ] /ui has a hero, calls to action, the install command, live parts and visuals, in the home page's style, in light and dark themes and at phone width.
- [ ] Samples compile (`check:samples`), the website builds, its tests pass, and the website e2e flows for /ui pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one page, built from the home page's components.
