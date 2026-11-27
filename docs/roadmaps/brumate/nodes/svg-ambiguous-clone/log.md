# Log: svg-ambiguous-clone

- Base proof, main at cdf7f880: `pnpm --filter brumate exec vitest run test/resume.test.ts -t "keeps SVG for an ambiguous"` fails at `.comp` (component with a top `<a>` inside `<svg>`): namespace is xhtml, expected svg.
- `#if` body and `#for` item with a top `<a>` already keep SVG on main in a browser render (bodies get the foreign context at compile time, `foreignContext`).
- Cause: a component root has no owner, so its template has no foreign context, and the clone is parsed as HTML. Fix: `cloneLines` returns false for an owner-less render with an ambiguous top element (`a`, `script`, `style`, `title`), so the HTML path parses it at insert, where `findForeign` knows the place.
- Branch: same command passes.
- The `em` inside an ambiguous `<a>`: `em` is a breakout element of the HTML parser, so the test only asserts it renders.
