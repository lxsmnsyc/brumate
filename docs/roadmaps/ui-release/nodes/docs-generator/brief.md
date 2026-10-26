---
id: docs-generator
title: Generate the props tables of the ui docs from the exported types
status: todo
priority: must
type: feature
target:
from:
size: M
spike: false
verify: pnpm --filter website exec vitest run test/props-table.test.ts
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - website/plugins/props-table.ts
  - website/src/components/PropsTable.brm
  - website/test/props-table.test.ts
shared:
  - website/vite.config.ts
  - website/plugins/markdown.ts
reserves: []
provides: [props-table]
depends_on:
  - on: props-types-main
    kind: contract
    via: part-props
---

# Generate the props tables of the ui docs from the exported types

## Goal

Build the generator that turns the exported props type of a part into a props table, with each prop, its type, its default and its doc comment. A page writes one line to show it. Define the format of the anatomy, data attribute and keyboard tables too, so the four docs nodes write the same thing.

## Context

- The types come from `<script module>` of each part (part-props contract). The website already has a markdown plugin in website/plugins/markdown.ts.
- Defaults come from the destructuring in `$props`, which the type does not hold. Read them from the source.
- Source: [Props tables, anatomy and keyboard tables in the docs](../../../../proposals.md#1-props-tables-anatomy-and-keyboard-tables-in-the-docs)

## Acceptance

- [ ] The button page shows a props table generated from `ButtonProps`, with types, defaults and descriptions.
- [ ] A test checks the table of one part against its type.
- [ ] The props-table contract is frozen, with an example of each table.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: reading types from .brm files is new to the website, but the TypeScript plugin already gives them.

## Notes for the worker

- Freeze the contract before the docs nodes start: they all write against it.
