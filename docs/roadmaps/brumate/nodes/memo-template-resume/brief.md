---
id: memo-template-resume
title: A memo of a template call inserted twice stays live after resume
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
  - docs/roadmaps/brumate/nodes/memo-template-resume/**
shared:
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/codegen/**
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# A memo of a template call inserted twice stays live after resume

## Goal

Found by the template-fragment-return review (2026-11-26), on `main` code (release/0.10 at a09f674e, also on 78f8bca2). A page renders `const shown = $memo(box(n))`, where `box` is a `#template`, in two places (`<div class="a">{shown}</div><div class="b">{shown}</div>`). After resume, incrementing `n` updates `.b` to `2` but `.a` keeps `1`. A render in the browser is correct. Find the cause and fix it.

## Context

- Prove it on `main` first with a failing resume test of that page, then fix it in a branch from `main` (hotfix, next patch 0.9.1). The release/0.10 work merges it in after.
- Likely areas: how the resume links one memo value to more than one insert (`linkCalls`, the insert table), and whether a template value can be held by two inserts at once.

## Acceptance

- [ ] A resume test of the page above fails on `main` and passes with the fix; a browser render and the server render still match (differential page in `test/render`).
- [ ] A patch changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: a resume fix with its cause unknown.
