---
id: children-handler-refs
title: A function used inside children that render later is defined in the browser
status: done
priority: should
type: fix
outline: false
milestone: core-correct
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/codegen/**
  - packages/brumate/src/analyze.ts
  - packages/brumate/test/**
reserves: []
provides: []
depends_on: []
---

# A function used inside children that render later is defined in the browser

## Goal

A script function or import used by markup inside a component's children (or a `#template`) that render later in the browser is defined when they render, however many times the page uses it.

## Context

- Found in the review of ui-docs-pages-overlays (#333), on main. Minimal repro: `Wrap.brm` is a button that toggles `#if (open) { <div>{children}</div> }`. `Page.brm` declares `function bump(){ n += 1 }` and uses it twice: `<button onClick=bump>top</button>` and `<Wrap><button onClick=bump>go</button></Wrap>`. Pressing toggle gives `ReferenceError: bump$ is not defined`; the built chunk has `function h(e){bump$.bind(null,e)...}` while the handler table has `h3:f,h4:f`. One use works; a plain `#if` works; two uses in nested children and a `#template` passed to ToastRegion fail the same way.
- Related: `prevent is not defined` in DialogTrigger > Popover > Dialog > `<Form onSubmit=(prevent(...))>` with a `TextField value=$bind` inside (not reduced further).
- Write the repro as a failing test first. Report the todos size; within 0.3 kB.

## Acceptance

- [ ] The repro and the `#template` case pass in the browser test harness, and the `prevent` case is reproduced and fixed or explained.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: likely one codegen path for names hoisted per use.
