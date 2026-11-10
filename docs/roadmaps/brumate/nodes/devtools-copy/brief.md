---
id: devtools-copy
title: Copy for an agent in the devtools
status: active
priority: must
type: feature
story: dev-dock-redesign
early: false
ship: auto
land: auto
outline: false
milestone: 0.8.0
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/devtools-copy.test.ts
exclusive: []
fulfilled_by: 
gate: false
added: 2026-11-09
spent:
owns:
  - packages/brumate/src/runtime/devtools-panel/copy.ts
  - packages/brumate/test/devtools-copy.test.ts
shared:
  - packages/brumate/src/runtime/devtools-panel/inspect.ts
  - packages/brumate/src/runtime/devtools-panel/issues.ts
  - packages/brumate/src/runtime/devtools-panel/activity.ts
  - packages/brumate/src/runtime/devtools-panel/call-detail.ts
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: dock-call-detail
    kind: hard
    why: reuses its clipboard helper and its Copy for an agent of a server call
---

# Copy for an agent in the devtools

## Goal

A button copies an error, a component or a handler run of the timeline as Markdown that an agent can read, with values cut at a length and nothing from cookies or headers.

## Context

- The devtools run only on the dev server.
- Source: [Copy for an agent in the devtools](../../../../proposals.md#copy-for-an-agent-in-the-devtools). It lists what each copy holds: an error (message, component, file and line, source around the line, scope values, brumate and Vite versions), a component (file, props, each slot by name, contexts, the `brumate inspect` report), a handler run (event, writes, updates, server calls with times).
- 2026-11-10: the maintainer counts this node as part of the dev-dock-redesign story, so it lands on `feat/dev-dock-redesign` before the story PR (#510) merges.
- The dock is split into workspace modules in `packages/brumate/src/runtime/devtools-panel/`: errors in `issues.ts`, components in `inspect.ts`, handler runs in `activity.ts`. `call-detail.ts` already has a clipboard helper (about line 364) and a "Copy for an agent" button for a server call (about line 534); reuse its helper and match its Markdown style, and move shared code into `copy.ts`.
- Story rules: match `../dev-dock-redesign/prototype/index.html` where it shows a copy control; otherwise put the button in the detail header beside the existing tools, as an icon button with a label, with instant feedback ("Copied").

## Acceptance

- [ ] Inspect (component), Issues (error) and Activity (handler run) each have a Copy for an agent button.
- [ ] A test copies each of the three and checks the Markdown, including that long values are cut and that no cookie or header value appears.
- [ ] The dock is checked in a browser (examples/tracker) after the change, bottom and right side.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/devtools`, then `pnpm lint`, `pnpm format:check`, `pnpm --filter brumate typecheck`.

## Sizing

M: three formats in the panel.
