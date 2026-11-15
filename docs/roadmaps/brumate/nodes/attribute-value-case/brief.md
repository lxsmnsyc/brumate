---
id: attribute-value-case
title: Enumerated attributes accept the values HTML accepts
status: done
priority: must
type: fix
outline: false
milestone: 0.7.1
target: main
from: 
size: S
spike: false
verify:
exclusive: []
fulfilled_by: 1b496e38 (batch/brumate-main)
gate: false
added: 2026-11-09
spent: 60000
owns: []
shared:
  - packages/brumate/elements.d.ts
  - packages/brumate/src/**
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# Enumerated attributes accept the values HTML accepts

## Goal

The element types accept every value that HTML accepts for an enumerated attribute: any letter case where HTML matches the keyword case-insensitively (`dir="LTR"`, `type="Submit"`), and the empty string where it is a valid state (`translate=""`).

## Context

- Found 2026-11-07 by the missing-attributes review (inbox.md). The types in packages/brumate/elements.d.ts list lowercase keywords only, so `dir="LTR"` and `type="Submit"` fail `brumate check`, and `translate=""` fails the `'yes' | 'no'` type. It fails on the base before missing-attributes too, so it ships in 0.7.0.
- The runtime switch words are in packages/brumate/src/runtime/html.ts (`SWITCHES`); check that the runtime handles the same values the types accept.
- Breaking changes are fine; size comes first, so this is types only unless the probe shows a runtime gap.

## Acceptance

- [ ] Probe on `main` first: a page with `dir="LTR"`, `type="Submit"` and `translate=""` fails the type check. If it does not, write why in the outcome and close the node.
- [ ] Each enumerated attribute that HTML matches case-insensitively accepts any case in the types, without falling back to `string` for the attribute.
- [ ] `translate=""` and any other empty-string state that HTML defines type-check.
- [ ] Type tests cover the cases above and a wrong keyword still fails.
- [ ] Patch changeset for brumate.

## Sizing

S: a type helper for case-insensitive keywords and tests.
