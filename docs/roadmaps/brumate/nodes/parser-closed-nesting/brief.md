---
id: parser-closed-nesting
title: Markup that the HTML parser closes early is an error, not a broken render
status: todo
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/check.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/src/runtime/server/**
  - packages/brumate/test/**
  - website/docs/errors.md
reserves: [BRM185]
provides: []
depends_on:
  - on: streamed-memo-reads
    kind: hard
    why: it adds BRM182 to BRM184 and edits analyze.ts and error-catalog.ts; this node takes the next code
---

# Markup that the HTML parser closes early is an error, not a broken render

## Goal

Found by transition-sibling-text (#364, outcome in nodes/transition-sibling-text/outcome.md). A `<Transition>` renders a `<div>`. Inside a `<p>`, the browser's HTML parser closes the `<p>` at the `<div>`, so `<p>T <!--b--><div>x</div><!--/b--></p>` becomes `<p>T <!--b--></p><div>x</div><!--/b--><p></p>`. The block's start and end markers land in different parents and the client throws "Missing end marker" (since #364 the message names the likely cause). happy-dom does not close the `<p>`, so unit tests never see it.

The maintainer chose (2026-10-30) to catch this before the browser does:

1. Compile error BRM185 when the compiler sees an element that the parser would close early or move: a block element (`div`, `section`, `ul`, `table`, headings, ...) inside `<p>`, and the other cases of the HTML spec's "implied end tags" and content rules that the compiler can see statically (for example `<a>` inside `<a>`, `<form>` inside `<form>`, `<li>` outside a list is not in scope). Pick the set from the spec, keep it small and certain: no false positives.
2. For elements the compiler cannot see (a component such as `Transition`, `as` props, dynamic tags), the server render in dev mode reports the same mistake with the component's name and file when it writes a start tag that would close the open `<p>` (or the other cases of step 1). Production renders stay unchanged and pay nothing.

Probe first: render the #364 repro on the server and parse it with parse5 to confirm the split, then write the check.

## Acceptance

- [ ] `<p>text <div>x</div></p>` fails to compile with BRM185, with a catalog entry and a docs entry in website/docs/errors.md that suggest `<span>`, `as="span"` or moving the element out of the `<p>`.
- [ ] `<p>T <Transition show={x}>x</Transition></p>` gives a dev-mode server error (or warning, decide and document) that names Transition and the file; a production build renders as before.
- [ ] Valid nesting (`<p><span>`, `<div><p>`, `<p>` inside `<li>`) compiles and renders with no report: tests prove there are no false positives.
- [ ] `pnpm --filter website check:samples && pnpm --filter website build` pass (no site page trips the check, or the page is fixed).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one static check with a small table from the spec, one dev-only check in the server writer, tests for both.
