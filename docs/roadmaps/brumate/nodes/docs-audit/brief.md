---
id: docs-audit
title: The docs match the code of 0.10.0
status: todo
priority: should
type: docs
story:
early: false
outline: false
milestone: 0.10.0
target:
ship: auto
land: auto
from:
size: L
risk: low
spike: false
hypothesis:
verify: pnpm --filter website check:samples
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-27
spent:
owns:
  - website/docs/**
  - website/ui/*.md
  - docs/roadmaps/brumate/nodes/docs-audit/**
shared:
  - packages/*/README.md
  - packages/brumate/skills/brumate/**
  - README.md
reserves: []
provides: []
depends_on:
  - on: state-printed-html
    kind: hard
    why: it changes the serialization and the state docs; audit the result, not the old text
  - on: template-call-insert-scopes
    kind: hard
    why: it changes how template calls resume; audit after it lands
---

# The docs match the code of 0.10.0

## Goal

The maintainer asked for a docs audit in 0.10.0 (2026-11-27). Before the release, every docs page says what the code on `release/0.10` does: no stale API, flag, error code or behavior, no feature of 0.10.0 left undocumented, and no broken link or sample.

## Context

- Scope: `website/docs/*.md`, the guide pages of `website/ui/*.md`, the package READMEs, the root README and the brumate skill (`packages/brumate/skills/brumate/`, its `references/`).
- 0.10.0 changes to check for: the client-scripts story (default scripts, dev pages, Nitro scripts and prerender, script nonce, dev client entry), kept pages getting the request's nonce (0.9.1), state-printed-html, BRM217 (`#defer` in content that can render in the browser), template-call-insert-scopes, and that brumate-node was dropped in favour of Nitro and `srvx/node` (decisions.md). Read the changesets on `release/0.10` (`.changeset/*.md`) and `git log main..release/0.10` for the full list.
- Method: the docs-site skill (agent-skills:docs-site). Run its checker on the site (`python3 <docs-site skill>/scripts/docs_check.py website/docs`, see `--help` for the entry and exports options) for structure, links, orphan pages and code fences. Then read each page against the code it describes: every option, export, error code and default it names exists and behaves as written. pr-review's `surface.py` finds mentions of removed names.
- Fix what is wrong in place. A page whose fix needs a code change, or a gap in the code itself, becomes a finding in the outcome for the orchestrator, not a code edit.
- Write with the plain-writing skill. Keep the website design rules (`website/DESIGN.md`).

## Acceptance

- [ ] `docs_check.py` reports no errors on `website/docs`; every warning fixed or explained in the outcome.
- [ ] Every 0.10.0 change in the changesets is documented on the page a reader would look for it.
- [ ] No page names an option, export, error code, command or default that the code does not have (outcome lists what was checked per page).
- [ ] `pnpm --filter website check:samples` and `pnpm --filter website build` pass.
- [ ] The skill's code blocks still compile (the skill test in `packages/brumate`).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

L: about 45 docs pages, the ui guides, the READMEs and the skill, each read against the code.
