---
id: partial-route-responses
title: A client navigation fetches only the routes that change
status: todo
priority: could
type: feature
outline: true
milestone: 0.6.0
target:
from:
size: L
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: html-attributes-navigation
    kind: hard
    why: both change how navigate.ts applies the next page; this builds on the attribute ownership it adds
---

# A client navigation fetches only the routes that change

## Goal

Today a link navigation fetches the whole next page as HTML, parses it, and then swaps only the route regions that changed (`planRoutes`, `replaceRoutes` in packages/brumate/src/runtime/navigate.ts). The client already knows which layouts it keeps. Send that with the request (for example a header with the kept route roots and the build), and let the server render and stream only the new routes, their head entries, their `<html>` attributes and their state records. A form, a reload or an unknown build still gets the full page.

Fewer bytes and less parsing per navigation, with the same model: the server renders, the client resumes, and pages that need no code still ship none.

## Context

- Chosen by the maintainer on 2026-10-30 over component-based routing (as in React Router or Solid Router). A client router would remove the HTML swap, but every page component would ship to the browser, server-only components and `await` in components would need to run in the browser (see browser-await-spike), and the core would need a render path beside resume. This node is the first step if navigation speed matters.
- To measure before and after: bytes and time to swap for a link between two docs pages that share layouts.
- Open questions for the refine: caching (the response varies on the kept routes), prefetch (prefetched responses today are full pages), the server API for rendering a subset of the route tree, streaming of later markup into a partial response.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
