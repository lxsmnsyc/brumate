# Log: template-value-imports

- 2026-10-27: Wrote GapPart.brm, GapTarget.brm (as in core-gaps-2.md section 1) and four gapTemplate fixtures. The four tests failed on main with `GapTarget is not defined`.
- `componentNames` reads only tags. A name in an attribute value is a read of a site, and `importsFor` took the reads of the sites of the part only. The fix adds the import reads of the non-deferred sites inside the rendered scopes, as `generateRender` does.
- The two ui `it.fails` tests of this gap (collections template, Toast) pass as `it`. The others of those files are other gaps and stay `it.fails`.
- `npx oxfmt --check` fails on docs/roadmaps/brumate/reviews/core-gaps-2.md, which is not in this branch's changes.
