# Log: single-child-blocks

- 2026-11-03: Nothing existed on `next`. Added `parseShortBody` in parser.ts, called by `parseBody` when `{` does not follow. `blockKeyword` also accepts `<` (not `</`) and `#` after a keyword, so `#try <A />`, `#else <B />` and `#catch <C />` are found. The AST is the same, so codegen, print.ts (a debug dump) and language-core (reads the parser) need no change.
- Chose to reword BRM044 instead of adding a code, since the case is the same one (no `{` after a header). BRM045 (#switch) is unchanged.
- TextMate grammar: the block rule ended at `{` or a lookahead for `<`; added `#`. The highlighter in src/highlight.ts already left the header on anything but `{`.
- `#else` binds to the nearest block (greedy), as in C. Documented.
- Full `pnpm test` under load gave 4 and then 19 failures in differential, render and check-command files; the six files pass alone (613 tests).
- Review fixes: docs say `#word` plus `<`, `#`, `(` or `{` opens a block and `{'#if'}` writes the text; a comment is not the child (documented, not allowed); tests for nearest-block `#else`; vscode grammar test for a short body and `this.#x` in a header. `{expr}` after a header is a braced body, so BRM044 never fires for it; it only fires for text and the other non-children.
