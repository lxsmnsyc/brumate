---
id: style-nonce
title: Component stylesheets carry the CSP nonce
status: done
priority: must
type: fix
story:
early: false
outline: false
milestone: 0.7.1
target: main
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by: 0c8d9d1e (batch/brumate-main)
gate: false
added: 2026-11-12
spent: 90000
owns: []
shared:
  - packages/brumate/src/runtime/html.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/client/page.ts
  - packages/brumate/test/styles/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# Component stylesheets carry the CSP nonce

## Goal

A page rendered with a `nonce` loads its component styles under a policy such as `style-src 'nonce-…'`. Today scripts and `<link rel="stylesheet">` get the nonce, but component `<style>` elements do not, so a strict policy blocks every scoped style.

## Current state

- `styleElement` (`packages/brumate/src/runtime/html.ts`) writes `<style b-style="…">` with no nonce. `Context.style` in `runtime/server.ts` calls it.
- The render already knows the nonce for its inline scripts (`nonce` in the render options, `runtime/server.ts`, around `<script nonce=…>`), and the `<link rel="stylesheet">` of bundle CSS gets it.
- `addStyle` (`runtime/client/page.ts`) creates `<style>` in the browser with no nonce. A browser-made element needs the page's nonce too, read from an element that has one (`element.nonce`, since browsers hide the attribute).
- `${}` interpolations write `style=""` attributes on the server, which `style-src-attr` covers. A nonce cannot apply to attributes. The browser path sets them through `style.setProperty`, which CSP allows. Note in the outcome what the server path needs; do not change it here.

## Acceptance

- [ ] First, prove it: a test that renders a styled component with a nonce and finds a `<style>` without it, failing on `main`.
- [ ] Server `<style>` elements carry the nonce when the render has one, and no `nonce` attribute when it has none.
- [ ] `addStyle` sets the page nonce on the elements it creates. Covered by a test.
- [ ] A patch changeset.
- [ ] Todos gzip size within 0.3 kB.

## Sizing

S: two writers of `<style>` and their tests.
