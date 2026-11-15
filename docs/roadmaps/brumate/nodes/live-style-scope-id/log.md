# Log: live-style-scope-id

## Proof on the base (2b94abf4)

Tests added to packages/brumate/test/resume.test.ts with fixtures liveStyleChildren.brm, LiveStyleInner.brm and liveStyleRows.brm in test/render. Run: `npx vitest run test/resume.test.ts -t "style variables"` in packages/brumate.

- children case: after the click on Open, the span `.x` has `b-v="[object Object]"` (assertion `not.toContain('[object')` fails).
- top-level `#for` case: the row the browser adds has `b-v="[object Object]"`, same failure.

Both reproduce. The fix writes `.id` when the component scope is outside the current render function (`componentId` in codegen/markup.ts). After it, both tests pass: the span goes from 10px to 20px after `w` changes.
