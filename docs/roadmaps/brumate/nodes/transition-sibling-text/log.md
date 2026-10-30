# Log

- 2026-10-30: the probes in packages/ui/test (text before, after and touching a Transition, in a server page and in a block the browser renders, with show true and false) all pass in happy-dom.
- The report came from a `<p>` with text before a `Transition`. Transition renders a `<div>`. A real parser (parse5 7.3.0) turns `<p>Text <!--b--><div>x</div><!--/b--></p>` into `<p>Text <!--b--></p><div>x</div><!--/b--><p></p>`: the markers end in different parents, so rangeEnd finds no end. happy-dom does not close the `<p>`, so no test here can fail on it.
- Not a bug of the part or of the markers: the markup is invalid HTML. Fix: the error names the cause (blocks.ts). Test in packages/brumate/test/range-end.test.ts.
