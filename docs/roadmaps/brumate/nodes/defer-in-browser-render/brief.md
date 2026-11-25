---
id: defer-in-browser-render
title: "A #defer block that the browser renders is not silent"
status: todo
priority: should
type: fix
story:
early: false
outline: false
milestone: 0.10.0
target:
ship: auto
land: auto
from:
size: M
risk: medium
spike: false
hypothesis:
verify: pnpm --filter @brumate/ui exec vitest run test/async-overlay.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-25
spent:
owns:
  - docs/roadmaps/brumate/nodes/defer-in-browser-render/**
shared:
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/project.ts
  - packages/brumate/src/runtime/client/**
  - packages/ui/test/async-overlay.test.ts
  - website/docs/async-data.md
  - website/ui/async-content.md
reserves: []
provides: []
depends_on: []
---

# A #defer block that the browser renders is not silent

## Goal

Found by part-guides (2026-11-25): a `#defer` inside a Dialog of a Popover or a Modal never loads its body. The overlay renders its content in the browser when it opens, and a `#defer` block that the browser renders keeps its `#else` for good. The compiler reports this only inside one file (`website/docs/async-data.md`, "#defer", lines 517-518), so a `#defer` in the children of an overlay part from another file fails with no message. Putting a lazy body in a dialog is a common path, so a silent fallback that never goes away is a bug (no limits on common paths).

## Context

- The failing test: `renders the #defer body of an overlay that the browser opens` in `packages/ui/test/async-overlay.test.ts`, an `it.fails` until this node lands. Fixtures `packages/ui/test/fixtures/async-overlays.brm`.
- A `#defer` request renders the route again on the server up to the block (`async-data.md`, "#defer"). A block that only the browser rendered has no place in the server's render, so the server cannot find it without more design.
- Two fixes, in order of preference:
  1. The browser fetches the body when it renders the block. Find first whether the server can answer it: the block's component, its props and the scope it would render in. If the answer needs a new protocol or a render path beside resume, stop at the design and write it in the outcome for the maintainer.
  2. Otherwise make the rule loud: `analyzeProject` reports a `#defer` that can render in the browser across files (in the children or slots of a component that renders them in the browser), with an error code and a hint to use `#loading` with a server function. The `it.fails` test then becomes a compile-error test.
- Until then, `website/ui/async-content.md` tells readers to use `#loading` with a server function.

## Acceptance

- [ ] The failing test is proven on the target first (it fails as `it`).
- [ ] Fix 1: the test passes as `it`, on the server and in the browser, and a `#defer` in a `#client` body loads too. Or fix 2: the project check reports the case across files with an error code in `error-codes.json`, and the ui test asserts the report.
- [ ] `async-data.md` and `async-content.md` say what the fix changed.
- [ ] A changeset (minor for fix 1, patch for fix 2).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: either a browser fetch path for `#defer` with its tests, or a cross-file check with an error code.
