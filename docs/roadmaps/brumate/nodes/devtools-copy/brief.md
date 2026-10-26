---
id: devtools-copy
title: Copy for an agent in the devtools
status: todo
priority: could
type: feature
outline: false
milestone: agent-skill
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/devtools-copy.test.ts
exclusive: []
fulfilled_by: 
gate: false
added: 
owns:
  - packages/brumate/src/runtime/devtools-panel.ts
  - packages/brumate/src/runtime/devtools-copy.ts
  - packages/brumate/test/devtools-copy.test.ts
shared:
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# Copy for an agent in the devtools

## Goal

A button copies an error, a component or a handler run of the timeline as Markdown that an agent can read, with values cut at a length and nothing from cookies or headers.

## Context

- The devtools run only on the dev server.
- Source: [Copy for an agent in the devtools](../../../../proposals.md#copy-for-an-agent-in-the-devtools)

## Acceptance

- [ ] A test copies each of the three and checks the Markdown.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: three formats in the panel.
