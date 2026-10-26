# Outcome: component-tag-handlers

## Built

- `spread` in packages/brumate/src/runtime/client.ts, with `on`: an incoming `b-on` (a prop that a dynamic tag naming a component passes) goes first into `on`, and no `b-on` attribute is written for it. The component's own `setOn` or `onAttribute` then writes one `b-on` with both sets of entries, as the server `spread` does.
- New helper `tagProps(attributes, scope, inner, ref)`, used by `dynamic` and `dynamicNodes` for a component tag. It adds `ref` and `children`, as before, and appends `@<scope>` to each `b-on` entry that has no scope, as the server `dynamic` does. It replaces the two `ref`/`children` blocks.
- `startAttributes` now only calls `spread(attributes, on)` and `onAttribute(on, '')`, as the server does, because `spread` takes the own `b-on`.
- Fixtures ScopeWrap.brm and componentTagHandlers.brm in packages/brumate/test/render/, and the test "a component in a dynamic tag keeps the handlers of its caller" in resume.test.ts, in `children`. It checks the `b-on` (`click=ScopeWrap#h1 click=AsButton#h4@<scope>`) and that both counters go to 1 on one click.
- Changeset .changeset/component-tag-handlers.md, a patch.

## Deviations

- Size is over the budget: +0.146 kB against 0.05 kB (see Size). The orchestrator decides.

## Stubs left

- None.

## Gotchas

- `spread` strips ` b-on="..."` from its output with a regex when `on` is given. `html.spread` writes `b-on` for an `Internal` value, so without that the HTML path would write two `b-on`, and the browser keeps the first.
- `tagProps` reads the scope as `(scope as Scope).id ?? scope`, so it needs a scope whenever the tag has handlers. The compiler always passes one then.
- Another worker (component-tag-live-props) also edits the client handling of a dynamic tag that names a component: both touch `dynamic` and `dynamicNodes` in client.ts, so expect a merge conflict in the `typeof tag === 'function'` blocks. `tagProps` now builds the props there.

## Proposed learnings

- The client and the server render a component in a dynamic tag the same way: `b-on` entries get the scope of the tag, and `spread` takes an incoming `b-on` first | the two had drifted, and the client lost the caller's handlers | packages/brumate/src/runtime | yes, a resume test with a component as `as`

## Verification

- The new test fails on main (`b-on` is `click=ScopeWrap_1pqzfbq#h1`) and passes with the fix.
- `npx vitest run` in packages/brumate: 55 files passed, 956 passed, 5 expected fails. Exit 0.
- `npx tsc --noEmit -p .` in packages/brumate: exit 0. `npx oxlint` and `npx oxfmt --check` from the root: exit 0.
- packages/ui tests not run: its node_modules were not linked, and only client.ts changed in packages/brumate.

## Size

- Eager core, gzip level 9, `client-*.js` (not client-routes) + `produce-*.js` of dist from `npx tsdown`: before 30854 + 3876 = 34730 bytes, after 31000 + 3876 = 34876 bytes. Growth 146 bytes, 0.146 kB, over the 0.05 kB budget. produce is unchanged. A first version grew 0.21 kB. The growth is the `spread` change (about 0.08 kB) and `tagProps` with its regex (about 0.07 kB).
- Estimated S, actual S.
