---
id: no-html-string-fallback
title: "No body that the browser renders falls back to an HTML string"
status: done
priority: must
type: refactor
outline: false
milestone: 0.6.0
target:
from:
size: S
spike: false
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-02
spent: 288000
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
reserves: []
provides: []
depends_on:
  - on: browser-async
    kind: hard
    why: after the 0.5.0 must line (client-restructure debate, step 2)
---

# No body that the browser renders falls back to an HTML string

## Goal

Every body that the browser renders is a cloned template, so the fixes that hold writes until a memo settles (#419, #421) apply everywhere. Today a `<template>` element or extra comments make the compiler fall back to an HTML string.

## Context

- Step 2 of the client-restructure debate (docs/debates/client-restructure/debate.md, O13, Q4). The rest of drop-marker-index (the MutationObserver marker index) is parked in the backlog.

## Acceptance

- [ ] A compile-time check or test shows no browser-rendered body uses the HTML string path, including `<template>` elements and comments.
- [ ] Tests that a constant async memo fills in those bodies.
- [ ] Todos within 0.3 kB.

## Sizing

S: about 0.2M tokens.
