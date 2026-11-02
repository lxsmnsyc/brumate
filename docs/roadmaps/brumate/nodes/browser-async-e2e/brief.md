---
id: browser-async-e2e
title: "e2e cases for async values in markup that the browser renders"
status: todo
priority: must
type: chore
story: browser-async
early: false
outline: false
milestone: 0.5.0
target:
ship: auto
from:
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-01
spent:
owns:
  - e2e/suites/browser-async/**
  - examples/browser-async/**
shared: []
reserves: []
provides: []
depends_on:
  - on: browser-loading-fallback
    kind: hard
    why: the e2e cases need the #loading fallback in browser renders
  - on: promise-in-markup
    kind: hard
    why: the e2e cases include a promise in text
---

# e2e cases for async values in markup that the browser renders

## Goal

The e2e suite covers the story acceptance in Chrome: an `#if` branch and a `#for` row that the browser renders, each with an awaited memo, a `#loading` fallback, and a promise in text, plus the root boundary holding a block outside every `#loading`.

## Context

- Check how e2e/run.mjs finds suites and examples before adding a new one; reuse an existing example app if one fits.

## Acceptance

- [ ] The cases pass in `node e2e/run.mjs`, three runs in a row.

## Sizing

S: one example page and one suite.
