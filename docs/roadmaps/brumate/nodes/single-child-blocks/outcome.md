# Outcome: single-child-blocks

## Built

- A block body is `{ ... }` or one markup child (element, component, dynamic tag, fragment or block): `parseShortBody` in `packages/brumate/src/parser.ts`. `#try <A /> #catch (e) <B />`, `#else <C />`, `#case (x) <p />` and `#default <p />` work. Text, `{expression}`, `<script>`, `<style>` and `#template` need braces; the error is BRM044, reworded to name both forms.
- Tests: `block bodies without braces` in `test/parser.test.ts` (each block kind, nesting, `#if (x) {name}`, rejections) and `test/codegen.test.ts` (server, client and parts equal the braced form); page `test/render/shortBodies.brm` passes the differential test.
- Docs: `docs/grammar.md`, `docs/decisions.md`, `website/docs/control-flow.md`, `website/docs/errors.md`, skill `references/syntax.md` and `references/errors.md` (generated).
- Editor: `packages/vscode/syntaxes/brumate.tmLanguage.json` ends the header at `#` as well.
- Changeset `.changeset/single-child-blocks.md` (brumate, minor).

## Deviations

- BRM044 reworded (its pin in `test/error-codes.json` edited by hand) instead of a new BRMnnn, since it is the same condition.
- Edited `packages/brumate/test/error-codes.json`, `packages/brumate/test/codegen.test.ts` and `packages/brumate/test/render/shortBodies.brm`; the last is under the brief's `packages/brumate/test/**`.
- No change to print.ts (a debug dump with one form), language-core or the highlighter.

## Stubs left

- None.

## Gotchas

- `blockKeyword` now treats `#word <x` and `#word #y` as a block, so text like `#defer <b>` starts a block. `#defer</p>` stays text.
- `#else` goes to the nearest block.

## Proposed learnings

- A keyword followed by `<` or `#` is a block start | keeps short bodies parseable | packages/brumate/src | yes (parser tests)

## Verification

- pnpm lint, format:check, `pnpm --workspace-concurrency=2 -r typecheck` (after build), `pnpm build`, `pnpm --filter website check:samples` (65 samples): pass.
- `pnpm test`: failures in load-sensitive files only; the six files pass alone (613 tests).

## Size

- Estimated M, actual S to M.

## Review fixes

- Docs (control-flow, skill syntax) name the block start rule and the `{'#if'}` escape; a comment is not the one child (BRM044), documented rather than allowed.
- Tests: nearest-block `#else` for `#for`, `#loading`, `#client`, `#defer`, `#switch` with a short `#if`, and an `#else` after `#catch` (BRM013); braced counter-case; `use {'#if'} <b>x</b>` stays text; vscode grammar test for a short body and `this.#x` in a header.
- `{expr}` after a header reads as a braced body, so BRM044 does not fire for it.
