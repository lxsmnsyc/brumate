# Log: template-call-insert-scopes

## 2026-11-27

- Base 53c27248 (release/0.10 + main, with #538). The work did not exist: `sharedScopes` and the
  `memo-template-twice` entry were both there.
- Failing test first: removed the `memo-template-twice` cause and its `diverge` line from
  `test/differential/data.ts`. `npx vitest run test/differential -t memoTemplate` fails on base:
  the browser has one scope per insert (`2: [1]` twice) and the server one; the memo slot holds
  markup (`{}`) on the server and the call in the browser.
- Added pages for a `const`, a signal and a prop, two and three inserts each (`constTemplate*`,
  `signalTemplate*`, `propTemplate*` with children `TemplatePropTwice`, `TemplatePropThrice`).
  On base all six fail: the memo and signal pages on scopes and the slot, the prop pages on
  scopes. The `const` pages fail in the browser render
  itself: a template with no scope returns its cloned nodes, and the second insert moves them, so
  the first insert ends empty.
- `plain` in `differential/run.ts` printed a `TemplateCall` with its scope objects; it now prints
  the arguments only, as it already leaves out the identity of functions, nodes and scopes.
- Server: `emitTemplate` emits the call wrapper (`box` -> `templateCall(ref, owner, box$, args)`)
  in both modes now. `templateCall` in `runtime/server.ts` gives a `Lazy` that renders the body at
  each insert, so each insert has its own scope. It is registered in `functionReferences`, so the
  page state sends `$b.f("X#T2", owner, args)`; `FunctionPlugin` in `serial.ts` now accepts an
  object too (deviation, one line).
- Client: `callable` turns a reference to `#T<n>` into a `TemplateCall` (`sentCall`), which
  renders with the new `T<n>` export of the update part. The export is emitted only for a template
  that some site calls other than as the whole expression of an insert.
- Client: a `RawNodes` inserted twice gives a copy to the second insert (the `const` bug).
- Removed `sharedScopes` (state.ts, blocks.ts, inserts.ts, resume.ts).
- Found while testing the signal pages: a handler arrow that calls a template, such as
  `() => (shown = box(2))`, threw `box is not defined`. `handlerExport` rewrote the arrow again
  and dropped the template code that `withTemplates` put around it. It now keeps that code when
  the site calls a template. Pre-existing on base, needed for the signal case.
- Differential: the 12 pages match. Resume tests added for each kind and for a resumed call
  inserted by a block that opens later (`signalTemplateLater`).

## 2026-11-27, review round 1 (PR #541)

- Blocking: the `T<n>` export did not import the components that its template renders
  (`packages/ui` `client-part-imports.test.ts`, 8 problems). The sent templates now join the
  scopes and sites of the update part. Page `signalTemplateComponent` times out on 05eccffb and
  passes now.
- A template with no slots, or with a destructured default, kept the eager `Promise<Raw>` on the
  server, sent as a promise that never settles. Every template now gets the call wrapper.
- A memo of a template that a prop passes crashed `ChildrenPlugin` (the key is on every
  `Children`, with no reference). The `fn` wrapper now carries the reference of the inner call,
  and the plugin skips children with no reference.
- `plain` keeps `ref` and the owner's place.
- The memo part still inlines the template. Calling `T<n>` from it was not small.
- Two new child pages throw on their own on the server, as other children do, so they are opt-outs:
  `PassedTemplateKid`, `ContextTemplateLater`.
