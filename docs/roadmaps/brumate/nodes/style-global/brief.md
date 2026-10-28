---
id: style-global
title: <style global> for a block of unscoped rules
status: todo
priority: should
type: feature
outline: false
milestone: 0.5.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/css.ts
  - packages/brumate/src/parser.ts
  - packages/brumate/src/codegen/**
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/test/**
  - packages/language-core/**
  - website/docs/styles.md
  - docs/grammar.md
reserves: []
provides: []
depends_on: []
---

# <style global> for a block of unscoped rules

## Goal

`<style global>` in a component holds rules that are not scoped, so a stylesheet of many unscoped selectors is written plainly instead of wrapping every selector in `:global(...)`. A plain `<style>` stays scoped, and both can sit in one component.

## Context

- Planned for the 0.5.0 release, not 0.4.0 (the maintainer, 2026-10-28).
- Asked by the maintainer on 2026-10-28: the styling sections of the @brumate/ui docs wrap every selector in `:global(...)` (about 870 times across 47 files in website/ui and website/src/routes/ui), where one global block would do.
- Today only `:global(...)` exists (packages/brumate/src/css.ts, about lines 74-129; website/docs/styles.md "Scoping" and "Global stylesheets").
- Decide and write in docs/decisions.md: whether a `<style global>` is sent with the component like a scoped style (and removed with it) or once per page; how it works with SCSS and Less (`<style global lang="scss">`); whether `:global(...)` inside it is an error or allowed; and the rule from docs/proposals.md that a style in a block cannot hold global rules (so `<style global>` only at the top level, with a catalog error otherwise).
- The editor tooling (packages/language-core) must accept the attribute. Update website/docs/styles.md and docs/grammar.md, and the brm skill if it covers styles.
- New syntax: minor changeset for brumate.

## Acceptance

- [ ] Tests: a `<style global>` rule applies to markup of child components with no scope attribute; a scoped `<style>` beside it stays scoped; a `<style global>` inside a block is a compile error with a code.
- [ ] website/docs/styles.md documents it.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one attribute through the CSS compile, a catalog entry, and docs.
