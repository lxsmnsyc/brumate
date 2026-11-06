---
id: template-scope-leak
title: A same-file template called from a browser-rendered component frees its old scopes
status: active
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
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# A same-file template called from a browser-rendered component frees its old scopes

## Goal

A component that the browser renders, with a `#for` that calls a `#template` of the same file, renders the template again at each update and never destroys the old scopes. The review of store-repair-compare probed it on origin/main with a plain `$signal` and no stores: scope counts [0, 6, 8, 10, 12, 14, 16], two more for each pick, none freed. The page leaks memory with every update.

Suspected cause (not confirmed): `write()` in packages/brumate/src/runtime/client/inserts.ts (about lines 137-196) takes the in-place path only for a server-rendered template insert. `renderedTemplate()` (about line 207) finds only server-rendered scopes, and `templateInserts.set` (about lines 187-190) depends on `scopes.get(made)` with `made = nextId`, which likely misses for a browser-made template. Each update then goes through the remove-and-rerender path (about lines 163-178), which removes the nodes but not their scopes.

Fix the in-place path for a browser-made template, and destroy the scopes of removed nodes on the rerender path.

## Acceptance

- [ ] A test: a browser-rendered component with a `#for` over a same-file `#template`; the scope count stays flat across several updates (fails on main).
- [ ] The rerender path destroys the scopes of the nodes it removes (cleanups run).
- [ ] Client size of the todos and ui examples measured before and after.

## Context

- Found by the store-repair-compare worker (outcome Follow-ups on feat/context-stores) and confirmed on main by its review, 2026-11-06.
