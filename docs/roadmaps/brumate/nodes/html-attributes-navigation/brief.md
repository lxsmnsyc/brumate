---
id: html-attributes-navigation
title: Client navigation keeps the attributes that scripts set on <html>
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
  - packages/brumate/src/runtime/navigate.ts
  - packages/brumate/test/**
  - e2e/suites/website.mjs
  - website/src/scripts.ts
reserves: []
provides: []
depends_on: []
---

# Client navigation keeps the attributes that scripts set on <html>

## Goal

Reported by the maintainer on 2026-10-30, a bug in brumate 0.3.0 and on main. On a client navigation, `navigate.ts` (about line 777, inside the `transition` callback) removes every attribute of `document.documentElement`, then copies the attributes of the next page's `<html>`. An attribute that a script set in the browser, such as `data-theme` from a saved theme choice, is lost. The inline script that applies the theme runs only on the first load: `updateHead` (about line 479) keeps a head element whose `outerHTML` is unchanged and does not run it again. So the choice is gone until a reload.

The website has the same setup: `website/src/scripts.ts` THEME_SCRIPT sets `data-theme` from localStorage, and Header.brm's toggle writes it. Nobody has tested it there yet.

Fix in the core, not in the site: navigation updates only the attributes that the server pages own. Keep the attributes of `<html>` that the last server page had (read them at load and after each navigation); on a navigation, remove those the next page does not have, and set the next page's values. An attribute that the browser added and the server never sent stays. Decide what happens when a script changed a server attribute (the next page's value wins is the expected answer) and document it in the navigation docs.

## Acceptance

- [ ] A test: an attribute set on `<html>` in the browser stays after a client navigation; an attribute that the old page sent and the next does not is removed; the next page's `lang` (or another sent attribute) is applied. It fails on main.
- [ ] The website keeps the dark theme across a client navigation (an e2e step: toggle the theme, follow a link, `data-theme` is still set).
- [ ] The docs of client navigation say which `<html>` attributes navigation changes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one function in navigate.ts, a unit test and an e2e step.
