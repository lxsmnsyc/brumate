---
id: svg-ambiguous-clone
title: An a inside svg keeps the SVG namespace when the browser renders it
status: todo
priority: should
type: hotfix
story:
early: false
outline: false
milestone: 0.9.1
target: main
ship: auto
land: auto
from:
size: M
risk: medium
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-26
spent:
owns:
  - docs/roadmaps/brumate/nodes/svg-ambiguous-clone/**
shared:
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# An a inside svg keeps the SVG namespace when the browser renders it

## Goal

Found by the template-fragment-return review (2026-11-26), on the base too (a09f674e). An element whose tag exists in both HTML and SVG (`a`, `script`, `style`) at the top of a block body (`#if`, `#for`) or a component, inserted into an `<svg>` by the browser, gets the HTML namespace. The server's markup puts it in SVG. After resume, a `#for` re-render also turns the server's SVG `a` into HTML. The markup serializes the same, so the differential test does not see it, but the element does not render as SVG.

## Context

- Repro: `<svg>{#if (on) { <a href="#x">t</a> }}<Comp/>{#for (x of [n]) { <a>…</a> }}</svg>`, with `Comp` rendering a top `<a>`; log `namespaceURI` in a browser render and after a resume update.
- template-fragment-return kept the HTML path for `#template` functions with such a top tag, so the insert picks the namespace (`hasAmbiguousTop` in `codegen/markup.ts`). Block bodies and components need the same: pick the template's namespace from the foreign context of the place they are inserted into, or keep the HTML path for those bodies.
- Prove it on `main` first, fix it from `main` (0.9.1), then merge into `release/0.10`.

## Acceptance

- [ ] A resume test asserts `namespaceURI` is SVG for the three cases, in a browser render and after a re-render; it fails on `main` and passes with the fix.
- [ ] A patch changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: the clone paths of blocks and components, and their tests.
