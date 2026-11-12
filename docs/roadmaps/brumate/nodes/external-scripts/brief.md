---
id: external-scripts
title: External scripts
status: todo
priority: must
type: feature
outline: true
milestone: 0.9.0
target:
from:
size: M
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
depends_on: []
---

> 2026-11-12: a must feature of 0.9.0 (docs/debates/0.9.0-cut/debate.md). Sized M: it touches the parser, the server render, the loader and navigation. Decide the inline form (`<script inline>`) when refining; survey how Astro, Qwik (Partytown) and Next (`next/script` strategies) mark and delay such scripts first.

# External scripts

## Goal

`<script src>` for a script of another site, with a `trigger` of `idle`, `visible` or `interaction`. To decide: inline scripts.

## Context

- Source: [External scripts](../../../../proposals.md#external-scripts)

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
