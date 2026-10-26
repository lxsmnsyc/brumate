# Outcome: component-tag-handlers

## Built

- The compiler writes each `b-on` entry of a dynamic tag with its scope: `click=Ref#hN@<scope>`. `emitDynamic` in packages/brumate/src/codegen/markup.ts builds it from the instance scope, `$$sN` inside a client render and `$$sN.id` outside, the rule of `anchor()`. A component that renders the element now gets entries that name the caller's scope, with no work in the browser.
- The client `spread` in packages/brumate/src/runtime/client.ts, with `on`: an incoming `b-on` goes first into `on` (in `spreadEntries`), and `spreadText` gets the attributes with `b-on` set to undefined, so no attribute is written and it stays out of the `b-s` list. The component's own `setOn` or `onAttribute` then writes one `b-on` with both sets of entries, as the server `spread` does.
- `startAttributes` now only calls `spread(attributes, on)` and `onAttribute(on, '')`, as the server does.
- The update of a dynamic tag with a spread (codegen/client.ts, `ownEvents`) passes the own handlers, with `@$$s.id`, as a `b-on` part of the values of `attrs`. Without it, `updateSpreadEntries` would drop the own entries, because they now carry `@` like the entries of a spread.
- The scope-adding code of the server `dynamic` (server.ts) is removed, and so is its `internal` import.
- Fixtures ScopeWrap.brm, componentTagHandlers.brm and dynamicKeysLive.brm in packages/brumate/test/render/, and two tests in resume.test.ts, in `children`:
  - "a component in a dynamic tag keeps the handlers of its caller": the `b-on` is `click=ScopeWrap#h1 click=AsButton#h4@<scope>`, and one click moves both counters;
  - "a dynamic tag keeps its own handlers when its spread updates": the own `onClick` still runs after `attrs` updates the spread.
- Changeset .changeset/component-tag-handlers.md, a patch.

## Deviations

- Files outside the brief's paths: packages/brumate/src/codegen/markup.ts and codegen/client.ts (the compiler writes and updates the scoped entries), packages/brumate/src/runtime/server.ts (the redundant code is removed), and the snapshot test/**snapshots**/render/blocks.txt. The reviewer asked for this design.
- Three expectations changed, because the own entries of a dynamic element tag now carry `@scope`: the `server render > blocks` snapshot (`b-on="click=...#h20@1"`), and the resume tests "writes the b-on of a dynamic tag escaped" and "a dynamic tag that changes its element keeps the handlers of a spread" (`#h9@-1`, `#h8@-1`). The scope names the same scope that the entry resolved to before, through `closest('[b-b]')`.

## Stubs left

- None.

## Gotchas

- Every own `b-on` entry of a dynamic tag now has `@scope`, so code that told own entries from spread entries by the missing `@` (`updateSpreadEntries`) cannot do it for a dynamic tag. The update of such a tag passes its own entries in the values for that reason.
- Another node, component-tag-live-props (#264), also edits the `typeof tag === 'function'` blocks of `dynamic` and `dynamicNodes`. This change leaves those blocks as they were on main.

## Proposed learnings

- A `b-on` entry that the compiler writes for a dynamic tag names its scope | a component can render the element in another scope, and the browser cannot guess the caller's scope | packages/brumate/src/codegen | yes, a resume test with a component as `as`

## Verification

- The first test fails on main (`b-on` is `click=ScopeWrap_1pqzfbq#h1`) and passes with the fix. The second fails with the compiler change alone (the own handler is lost), and passes with `ownEvents`.
- `npx vitest run` in packages/brumate: 55 files, 960 passed, 5 expected fails. Exit 0.
- `npx vitest run --maxWorkers=2` in packages/ui: 54 files, 505 passed. Exit 0.
- `npx tsc --noEmit -p .` in packages/brumate, `npx oxlint` and `npx oxfmt --check`: exit 0.

## Size

- Eager core, gzip level 9, unminified `client-*.js` (not client-routes) of dist from `npx tsdown`: main 30856 bytes, after 30890 bytes. Growth 34 bytes, 0.034 kB, within the 0.05 kB budget. The produce chunk is unchanged at 4013 bytes. A minified number was not measured: esbuild gave no output here.
- Estimated S, actual S.
