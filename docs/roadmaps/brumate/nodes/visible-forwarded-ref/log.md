# Log

- The caller cannot know the forwarded element at compile time: the element is in the child's scope. So the child marks it.
- Child (server mode): an element with `ref=$bind(prop)` writes `b-r="S.slot"`, the scope and slot of the signal at the end of the bindings, from `$$ctx.refKey`.
- First try failed: `$$ctx.bindings` ran after the markup, so `record.b` was empty when the element rendered. Added `$$ctx.bound`, called before the markup, and `bindings` calls it too. A relay that passes the binding on resolves through `record.b`.
- Caller: a visible `$client` that reads a signal of its scope, which some `$bind(signal)` passes (no setter), writes `b-near="S.slot"`. The loader selects `[b-b=near],[b-r=near]`. With no `b-r` element, it falls back to the element after the marker, as before.
- The loader was checked against a stub IntersectionObserver in resume.test.ts. Before the change, the test observed the heading.
- Not covered: `ref` left in rest props (`restRef`), which has no marker.
- Size, todos client JS gzip (all files, gzip -9): main 29801 B, branch 29805 to 29807 B (+4 to +6 B).
- `pnpm format:check` fails on docs/roadmaps/brumate/archive.md, which this node does not touch (main has the same failure).
- Review fixes: `b-r` is written only for keys that a visible `$client` recorded through `$$ctx.near`; docs and outcome narrowed to the server render; origin/main merged (archive.md formatting fixed there). Test: no `b-r` without a visible `$client`.
