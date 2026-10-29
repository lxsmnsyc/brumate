---
id: drop-colon-modifiers
title: Remove event modifiers in the attribute name
status: todo
priority: should
type: feature
outline: false
milestone: 0.5.0
target: next
from:
size: S
spike: false
verify: "! grep -rqE 'on[A-Z][A-Za-z]*:[a-z]+=' --include='*.brm' packages && pnpm --filter brumate exec vitest run test/parser.test.ts test/diagnostics.test.ts"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-29
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/parser.ts
  - packages/brumate/src/ast.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/print.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/test/parser.test.ts
  - packages/brumate/test/diagnostics.test.ts
  - packages/brumate/test/render/todos.brm
  - packages/brumate/test/fixtures/todos.brm
  - packages/brumate/test/vite-app/todos.brm
  - packages/vscode/syntaxes/**
  - packages/vscode/test/grammar.test.ts
  - docs/decisions.md
  - docs/grammar.md
  - website/docs/**
reserves: []
provides: []
depends_on:
  - on: next-branch
    kind: hard
    why: the removal breaks pages that use the colon form, so it ships in 0.5.0 from next, not in a 0.4.x patch
---

# Remove event modifiers in the attribute name

## Goal

`onSubmit:prevent=save` is a compile error on elements, `<window>` and `<document>`, as it already is on components. The error names the wrapper of `brumate/events` to use, as the warning does today: `onSubmit=(prevent(save))`, and for `:passive`, a plain handler. Wrappers are the only way to write a modifier.

## Context

- decisions.md:112 says the colon form "works with a warning until a later version". The maintainer chose 0.5.0 as that version (2026-10-29). Old APIs are removed outright, with no further warning period.
- Today: parser.ts reads `{ ":" Modifier }` into `EventAttribute.modifiers` (ast.ts:128), and `readWrappers` in analyze.ts:438 warns. BRM022 rejects an unknown modifier, and BRM023 rejects any modifier on a component.
- The `b-on` format keeps its modifiers (`keydown:prevent(Escape)=…`). The wrappers write them, and the loader, boot.ts, shared.ts, html.ts and the devtools read them. Only the attribute syntax goes.
- Three fixtures still use the colon form: `<form onSubmit:prevent=add>` in test/render/todos.brm, test/fixtures/todos.brm and test/vite-app/todos.brm.

## Tasks

- parser.ts: a `:` after an event name fails with one error, BRM022 with a new text, which also covers components: `Event modifiers in the attribute name were removed. Write {name}=({modifier}(handler)) with {modifier} from brumate/events`, and for `passive`, that listeners are passive unless a handler prevents. Drop `modifiers` from `EventAttribute` and from print.ts.
- analyze.ts: remove the warning from `readWrappers` and its doc comment.
- error-catalog.ts and website/docs/errors.md: BRM022 says the form was removed and shows the wrapper, as BRM142 does for `$cleanup`. Remove BRM023, which BRM022 now covers.
- Fixtures: `onSubmit=(prevent(add))` with the import of `prevent`.
- VS Code grammar: the `:modifier` scope goes; update grammar.test.ts.
- Docs: docs/grammar.md (the `Modifier` rule), decisions.md:112, website/docs/markup.md:184 and website/docs/reference-blocks.md:85.
- A minor changeset for `brumate`, and one for the VS Code extension if its grammar changed.

## Acceptance

- [ ] parser.test.ts: `onSubmit:prevent=save` on an element, on `<window>` and on a component each fail with the new error, which names the wrapper; `:passive` names a plain handler.
- [ ] diagnostics.test.ts: the warning test becomes the error test; the `b-on` tests of wrappers pass unchanged.
- [ ] No `on[A-Z]\w*:` attribute is left in a `.brm` file of the repo.
- [ ] The packages/brumate, packages/ui and packages/vscode suites pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one parser branch, a removed warning, three fixtures and the docs.
