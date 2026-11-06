---
id: module-script-shared
title: A component rendered in the browser shares its <script module> with the resumed ones
status: done
priority: must
type: fix
outline: false
milestone: 0.6.1
target: main
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns: []
shared:
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# A component rendered in the browser shares its <script module> with the resumed ones

## Goal

Found in the review of PR #470 and reproduced on main (88e5135f): `clientModuleScript` in packages/brumate/src/codegen/render.ts (about line 120) copies the `<script module>` statements into the render module. A component that the browser renders then gets its own module state, separate from the instances that resumed. The render module must import the shared part instead.

Reproduction: a component with `<script module>const box = { n: 0 }</script>`, a signal `t`, `<p>{box.n}:{t}</p>` and a button doing `t = ++box.n`. Resume it, click (box.n is 1), then insert a second copy with `#if`. The second shows `0:0`; it must show `1:0`.

## Acceptance

- [ ] The reproduction as a test: fails on main, passes after.
- [ ] A browser-rendered and a resumed instance share one `<script module>` state, also for a component that only the browser renders.
- [ ] Todos client JS before and after.
- [ ] A patch changeset.

## Sizing

M: render codegen and the module graph of the client build.
