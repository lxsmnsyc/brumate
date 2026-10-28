# Outcome: website-fixes

## Built

- Brand mark. Cause: the style `.brand-mark` sat in Header.brm. A scoped style gets its attribute only on the elements of its own file, and the SVG belongs to BrandMark.brm, so the rule never matched. The SVG has a viewBox and no size, and it did not show in the flex row. The rule is now in BrandMark.brm. Both home links ("brumate" and "brumate/ui") show the mark, in light and dark.
- Error section. The proposal asks to drop the colored left border. #320 had changed it to `--danger`, and the border was still there. `border-left` is removed from `.type-error`. The tinted background and the red label stay.
- Shop demo. `NETWORK_SCRIPT` now reads `data-only`, a list of name prefixes, split by spaces, matched with `indexOf`, so a bad value cannot throw. Network.brm takes an `only` prop, and the home page passes `core Index Shop`. The list shows the page bundle and the core runtime (1.9 KB) and no longer the loader, layout and site chunks. Without `only`, a panel shows every script as before.
- Highlighting. `reveal` and `defer` are in the highlighter list. `BLOCK_KEYWORDS` of the highlighter and `BLOCK_KEYWORDS` and `BRANCH_KEYWORDS` of the parser are exported. packages/brumate/test/highlight.test.ts compares them and fails when they differ.
- Changeset .changeset/website-fixes-highlight.md (patch).

## Deviations

- `repeat` stays in the highlighter. The brief says to drop it, but the parser has `#repeat` as a block, and the docs describe it. Dropping it would unhighlight a real block and break the new test.
- The proposal asks to take the list from one place. The PR keeps two lists, one in the highlighter and one in the parser, and a test fails when they differ. A shared list would pull the parser into the highlighter entry.
- The highlighter list is in packages/brumate/src/highlight-keywords.ts, which no package entry exports, so `brumate/highlight` gains no public export. The parser exports its two sets from parser.ts, which index.ts does not re-export.
- packages/brumate/src/parser.ts is outside `owns`. The only change is `export` and a type annotation on two sets, which the declaration build needs.
- Network.brm and index.brm are changed for the shop list. Network.brm is outside `owns`.
- The check of the rest of the grammar against the parser (proposal, second bullet) is not done.

## Stubs left

- None.

## Gotchas

- A scoped style of a parent does not reach the markup that a child component renders. Put the style of an element in the file that renders it.
- `data-only={only}` is the spread shorthand and printed `[object Object]`. Write `data-only=only`.

## Verification

- Screenshots in the scratchpad: website-fixes-home-header-dark/light, website-fixes-ui-header-dark/light, website-fixes-error-section, website-fixes-shop-demo.
- oxfmt --check and oxlint (no errors), tsc and highlight test in packages/brumate, brumate-tsc, check-samples (63 samples), website tests, website build: pass.
- e2e: a new step loads / fresh and checks that the shop list has a row that starts with Index. A chunk rename now fails it.
