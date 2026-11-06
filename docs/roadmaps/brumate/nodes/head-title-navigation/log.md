# Log: head-title-navigation

- Reduced steps from #467 as written (two routes under a layout, `#head { <title>{title}</title> }` with a memo, away and back with links) pass on main when the pages render on each request. Tried first in `examples/todos`.
- Varied: prerendered build served as files. It fails on main, in the step after coming back to the page.
- Cause found in the prerendered HTML: `<!--P2--><title b-b="2:0" b-t>Titles</title><!--/P-->` in the head. A static file renders IDs from 0, so `navigate()` shifts the IDs of the page above those of the live page (`shiftIds`). It shifted `next.body` only, so the `b-b` of the head title stayed `2:0` and pointed at another scope of the live page. The text binding never reached the title.
- Fix: `shiftIds(next.head, shift)` before `next.body`.
- Unit test in `packages/brumate/test/navigate.test.ts` (head title with `b-b="1:0"` shifts to `3:0`): fails on main, passes on the branch.
- e2e needs prerendered pages. `examples/todos` is the client-size reference, so the routes `/titles` and `/titles/other` went to `examples/tracker`, which prerenders them with `/about`. The step is in `e2e/suites/tracker.mjs`.
- Did not try the dev server: the dev server renders each request with the base of the live page, so no shift happens.
