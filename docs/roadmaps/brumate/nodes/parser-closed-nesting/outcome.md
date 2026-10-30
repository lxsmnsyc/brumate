# Outcome: parser-closed-nesting

## Built

- BRM185 in `packages/brumate/src/nesting.ts` (`checkNesting`), run from `analyze.ts`. Rules, each checked against parse5 (see log.md):
  - a block element (the start tags that close a `<p>` in the HTML spec, such as `div`, `section`, `ul`, `li`, headings, `form`, `pre`) with a `<p>` open in button scope; a `<button>`, `<td>`, `<th>`, `<caption>`, `<table>`, `<template>`, `<svg>` or `<math>` between them ends the scope;
  - a heading directly in a heading, `<li>` directly in `<li>`, `<dd>` or `<dt>` directly in `<dd>` or `<dt>`;
  - `<a>` in `<a>` (stopped by `td`, `th`, `caption`, `template`, `object`, `marquee`, `applet`), `<form>` in `<form>` (stopped by `template`), `<button>` in `<button>`;
  - an element other than the table parts directly in `<table>`, `<thead>`, `<tbody>`, `<tfoot>` or `<tr>`.
  - Nothing is checked through a component, a dynamic tag, `#portal`, `#head` or `#offscreen`, and nothing inside `<svg>` or `<math>`.
- Catalog entry, docs entry (`website/docs/errors.md`), pinned message (`test/error-codes.json`) and the skill copy (`skills/brumate/references/errors.md`).
- Dev check: `component()` in `runtime/server.ts` takes a sixth argument, set by the compiler (`codegen/markup.ts`) only in dev builds, for a component inside a `<p>`. In development (`dev: true`) a component whose output starts with an element that closes the `<p>` makes the render throw, naming `<Name> in file:line:col`, with BRM185. Production renders are unchanged.
- Tests: `packages/brumate/test/nesting.test.ts` (13 reports, 15 silent cases, components/portals, the server hint, dev throw, production render, no-false-positive for inline output).
- Changeset: `.changeset/parser-closed-nesting.md` (brumate minor).

## Deviations

- New file `packages/brumate/src/nesting.ts`, and edits to `src/codegen/markup.ts` (the hint argument), `src/runtime/server.ts` (the brief lists `runtime/server/**`, which is a file here) and `skills/brumate/references/errors.md` (mirror of the catalog). None is in the brief's shared paths.
- The hint is dev-only: the compiler emits it when `hideNames` is unset (the dev server), so a build carries nothing.
- The server check covers `<p>` only. Other cases are compile-time only.
- `<table>` in `<p>` is not reported (quirks mode keeps the `<p>`).
- Dev check is an error, not a warning.

## Stubs left

- None.

## Gotchas

- Components pass children through; a `<div>` in the children of a component inside a `<p>` is not seen, since the compiler does not know where the component puts them.
- Follow-up: the server check covers `<p>` only. Extending it to `<a>`, `<form>`, `<button>`, `<li>` and table ancestors would need the hint on more component calls in dev.
- Dynamic tags (`<Dynamic>`/`as` at runtime) are not checked on the server, since `dynamic()` does not carry the hint.

## Proposed learnings

- Keep node stripping syntax in `packages/brumate/src`: no parameter properties (`constructor(private x)`) | `node src/cli.ts` runs the files with type stripping only | packages/brumate/src | no

## Verification

- `npx vitest run test/nesting.test.ts test/check-command.test.ts test/skill.test.ts` in packages/brumate: pass.
- A compile of 520 `.brm` files outside fixtures and tests: 0 BRM185.
- `pnpm --filter website check:samples`: 65 samples, 0 problems.
- Fast check and website build: see the PR.

## Size

- Estimated M, actual M.
