---
id: single-child-blocks
title: A block body can be one markup child without braces
status: todo
priority: could
type: feature
outline: false
milestone: 0.6.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-02
spent:
owns: []
shared:
  - .changeset/*.md
  - docs/grammar.md
  - docs/decisions.md
  - packages/brumate/src/parser.ts
  - packages/brumate/src/ast.ts
  - packages/brumate/src/print.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/test/parser.test.ts
  - packages/brumate/test/diagnostics.test.ts
  - packages/brumate/skill/**
  - packages/vscode/syntaxes/**
  - packages/language-core/**
  - website/docs/control-flow.md
  - website/docs/markup.md
reserves: []
provides: []
depends_on: []
---

# A block body can be one markup child without braces

## Goal

Every block body (`Body` in docs/grammar.md) can be a single markup child in place of `{ ... }`:

```brm
#try <UnsafeComponent /> #catch (error, reset) <Fallback {error} {reset} />
#if (user) <Profile {user} /> #else <SignIn />
#for (item of items by item.id) <Row {item} />
```

## Context

- Asked by the maintainer on 2026-11-02. Nothing in docs/decisions.md rules it out; record the decision there when built.
- A single child is one element (with its children), one component, one dynamic tag, or one block. It is not text and not an interpolation: `#if (x) {name}` already means a braced body that holds the text `name`, so `{` after a block header always opens a body.
- A body without braces cannot hold a block `<script>` or `#template` declarations; those need braces.
- `#switch` keeps its braces around the cases; each `#case` and `#default` body may be a single child.
- Decide at refine: whether the printer (`print.ts`) keeps the short form or always prints braces, and whether the TextMate grammar (packages/vscode/syntaxes) and the language service need changes for folding and completion.
- Error for a body that is neither braces nor one markup child (new BRMnnn, reserve it at refine), with a hint to add braces.

## Acceptance

- [ ] Every block with a `Body` accepts one markup child, with parser tests for each block kind and for nesting (`#if (a) #if (b) <p />`).
- [ ] Compiled output for the short form equals that of the braced form, for server and browser renders.
- [ ] `#if (x) {name}` keeps its current meaning, with a test.
- [ ] docs/grammar.md, website/docs/control-flow.md and the skill show the short form.
- [ ] A minor changeset for brumate.

## Sizing

M: parser, printer, grammar docs, editor grammar and tests. No codegen change, since the AST is the same.
