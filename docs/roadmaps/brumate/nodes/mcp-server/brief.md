---
id: mcp-server
title: An MCP server in the dev server
status: todo
priority: later
type: story
outline: true
milestone: backlog
target:
from:
size: L
spike: false
verify: 
exclusive: []
fulfilled_by: 
gate: false
added: 2026-11-12
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: skill-tasks
    kind: hard
    why: the pieces before it show which tools agents use
---

> 2026-11-12: a must feature of 0.9.0 (docs/debates/0.9.0-cut/debate.md). Its dependency skill-tasks is done, and its outcome shows which checks agents need.

> 2026-11-18: deferred to the backlog by the maintainer, who wants to learn more about MCP before building it. Out of the 0.9.0 cut and out of release-0.9's dependencies.
>
> Notes from the 2026-11-18 analysis, for when it is refined: the docs and check tools would mostly wrap what agents already have (`/llms.txt`, `brumate check --json`). The new value is live page state: component tree, signal values, the reactive graph, server calls and errors, which today only a person can copy out of the dock. Shape: an HTTP endpoint in the Vite plugin (`/__brumate/mcp`), server tools in the dev server, and page tools through a relay over the HMR websocket that reuses the Markdown builders of devtools-copy. Building the live tools first likely brings it from L to M.

# An MCP server in the dev server

## Goal

Tools that search the docs, inspect a component, check a file and read the open page.

## Context

- Source: [An MCP server in the dev server](../../../../proposals.md#later)

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
