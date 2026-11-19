---
id: style-files-inline
title: "The server inlines the CSS of the components it renders"
status: todo
priority: must
type: feature
story: style-files
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-19
spent:
owns: []
shared:
  - packages/brumate/src/vite.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/route-render.ts
  - packages/brumate/src/runtime/sheets.ts
  - packages/brumate/src/runtime/navigate.ts
  - packages/brumate/src/runtime/bundles.ts
  - packages/brumate/src/runtime/defer.ts
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/test/**
  - benchmarks/navigation/**
  - e2e/suites/**
reserves: []
provides: []
depends_on:
  - on: style-files-navigation
    kind: hard
    why: it changes the head links and the stylesheet waits that node wrote
---

> 2026-11-19: added after `../../reviews/style-files-fcp.md`. Linked component stylesheets made first-load FCP about 1.2 s slower on Slow 4G (692 to 1928 ms on `/`) and 0.33 s slower on Fast 4G, with no gain on warm loads or navigation. The maintainer asked to find the critical CSS and inline it in server renders.

# The server inlines the CSS of the components it renders

## Goal

The critical CSS of a server-rendered page is the CSS of the components the server renders for it, which the server already knows: `Context.style(id)` runs at the first instance of each component with CSS. The server writes that CSS inline as `<style b-style>` where it writes the `<link>` now, so the first paint waits for no stylesheet request. The bundle stylesheets still exist as cacheable files, but the page loads them without blocking the first paint, so that client navigation and components the browser renders later find them in the cache. The client JS still carries no `$$css`.

Above-the-fold critical CSS, as beasties or critters compute it, is not the goal: it needs a layout pass in a browser at build time and does not fit per-request server renders.

## Notes

- The server needs each component's CSS text. The build can emit it into the server bundle (a map from component ID to CSS, next to the `components` map in hints.json), never into client chunks.
- A component first rendered inside a `#defer` body, or after the head was sent, gets its `<style>` in place in the body, as inline styles did before style-files.
- Non-blocking bundle sheets: `rel=preload as=style` in the head, turned into stylesheets by the client after load, or links added by the client after load. Pick the simpler one. Navigation keeps waiting for the next page's sheets before the swap (style-files-navigation); those are then usually cached.
- Rule order: inline rules and the later linked copy are the same rules, so applying both must not change the cascade. Check equal-specificity order on a page that renders a component inline and then links its bundle.
- Navigation: a fetched page now carries inline `<style b-style>`. The swap and the head prune must handle them (keep, dedupe by component scope, or drop once the sheet is linked).
- A relative base keeps the inline path it has today.

## Acceptance

- [ ] With the throttled harness (`node benchmarks/navigation/run.mjs --first-load --network slow4g --cpu 4 --gzip`, 20 runs, ABAB batches, load at most 4), first-load FCP of `/` and `/docs/components/` is within noise of the base `f5cd683b`, and the head has 0 render-blocking component CSS requests. Record the Fast 4G and unthrottled numbers too, in `../../reviews/style-files-fcp.md`.
- [ ] Warm-load FCP and the navigation swap times stay within noise of `feat/style-files` before this node.
- [ ] No `$$css` and no component CSS in any client JS chunk (the existing style-files test).
- [ ] A component the browser renders after load, a `#defer` body and a client navigation show no unstyled frame (the existing e2e steps pass).
- [ ] HTML gzip of `/` and `/docs/components/` is recorded against `f5cd683b` and `feat/style-files`.
- [ ] Full check passes: `pnpm build && pnpm test && node e2e/run.mjs`, including the `/ui/selection-indicator` contrast check.
