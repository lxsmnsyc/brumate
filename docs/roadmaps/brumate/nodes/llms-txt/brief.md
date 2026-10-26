---
id: llms-txt
title: llms.txt, the Markdown of each page, and a copy button
status: todo
priority: should
type: feature
outline: false
milestone: agent-skill
target:
from:
size: M
spike: false
verify: pnpm --filter website exec vitest run test/llms.test.ts
exclusive: []
fulfilled_by: 
gate: false
added: 
owns:
  - website/plugins/llms.ts
  - website/src/components/CopyMarkdown.brm
  - website/test/llms.test.ts
shared:
  - website/vite.config.ts
reserves: []
provides: []
depends_on: []
---

# llms.txt, the Markdown of each page, and a copy button

## Goal

The website builds /llms.txt, /llms-full.txt and the Markdown of each page at its path with `.md`, from the same files as the search index, and each page has a button that copies its Markdown.

## Context

- The search index already turns the docs and the ui pages into plain text.
- Source: [Docs for agents on the website](../../../../proposals.md#docs-for-agents-on-the-website)

## Acceptance

- [ ] The build writes the three outputs.
- [ ] A test checks that every page is listed in llms.txt.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: a Vite plugin and a button.
