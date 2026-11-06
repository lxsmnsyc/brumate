---
id: prerender-defer-context
title: A prerendered page with browser code still renders its #defer body for the request
status: todo
priority: must
type: fix
outline: false
milestone: 0.6.1
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-06
owns: []
shared:
  - packages/brumate/src/**
  - packages/brumate/test/**
  - examples/tracker/**
  - e2e/suites/tracker.mjs
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: prerender-search-params
    kind: soft
    why: both add pages or steps to examples/tracker and e2e/suites/tracker.mjs
---

# A prerendered page with browser code still renders its #defer body for the request

## Goal

examples/tracker `/about` is prerendered. Its `#defer ('load')` body reads the `CurrentUser` context, and the server renders that body per request, so a signed-in user sees "You are signed in as …". Add a signal that browser code writes to the same page, and the body shows "You are not signed in." for a signed-in user, after a full load and after client navigation, and it stays so.

Confirmed on main 94024308 (2026-11-06): add to about.brm `let loaded = $signal(false); $client(() => { loaded = true; }, 'load');` and `<p class="loaded">{loaded ? 'loaded' : 'not loaded'}</p>`. The tracker e2e step "/about: the prerendered page opens from a link and as a file" then fails; `.who` reads "You are not signed in." Without the `$client` write it passes (14/14).

Likely cause, not confirmed: once the page has browser code, the `#defer` body renders in the browser from the page state, where the prerender step stored `CurrentUser` as `null` (the build has no request), instead of asking the server for the body. Find where the choice between a server-rendered and a browser-rendered `#defer` body is made, and keep the server render for a prerendered page whose body reads request data (a context, cookies), or make the browser ask the server.

Found by the prerender-search-params worker (#474).

## Acceptance

- [ ] An e2e step (tracker) or test: a prerendered page with a browser-written signal and a `#defer` body that reads the user context shows the signed-in text, after a full load and after client navigation (fails on main).
- [ ] The existing /about step still passes.
- [ ] Client size of todos and ui measured.
