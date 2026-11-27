---
id: template-call-try
title: "A template call that throws is caught by the #try of its insert in the browser too"
status: active
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
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-27
spent:
owns:
  - docs/roadmaps/brumate/nodes/template-call-try/**
shared:
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: template-call-insert-scopes
    kind: hard
    why: that node moves the server render of a template call to its insert; this fixes the browser side on top of it
---

# A template call that throws is caught by the #try of its insert in the browser too

## Goal

Found by the review of template-call-insert-scopes (#541, 2026-11-27), and on base `release/0.10` too: with `const c = boom(1)` outside a `#try` and `{c}` inserted inside it, the server catches the error in the `#try` and shows its `#catch`, but the browser render does not: the page comes out empty and the error escapes. The server and the browser must agree: the `#try` around the insert catches an error of the template body, in a server render, after resume, and in a browser render.

## Context

- Since template-call-insert-scopes, the server renders a scoped template call at each insert (`templateCall`, sent as `$b.f`), so the server already catches at the insert. Find where the browser renders the call (`sentCall`, the `T<n>` export, the browser render of a `const` holding a call) and run it inside the insert's `#try` boundary.
- Decide and document where the error of the call itself (arguments, not the body) belongs.
- The reviewer's probe pages of #541 are in this node's `probes/` folder (the `#try` case among them); rebuild the case as a differential page and a resume test.

## Acceptance

- [ ] A differential page with the call outside a `#try` and the insert inside it matches; a resume test and a browser render test show the `#catch`.
- [ ] The same for a memo, a signal and a prop holding the call.
- [ ] `website/docs` (the `#try` section of control flow) says which `#try` catches a template's error.
- [ ] A patch changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: the browser render path of template calls inside an error boundary, with tests for four value kinds.
