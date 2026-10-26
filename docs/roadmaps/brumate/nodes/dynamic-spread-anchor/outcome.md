# Outcome: dynamic-spread-anchor

## Built

- A forwarded `ref` of a dynamic tag now reaches a component that spreads its props onto its root. In `emitElement` of packages/brumate/src/codegen/markup.ts, an element with a spread and an anchor writes its own `b-b` before its attributes, not after. The browser keeps the first `b-b`, so the element's own wins over the one that the dynamic tag passes in the props.
- Fixtures packages/brumate/test/render/RefSpread.brm and refForwardSpread.brm, and the test "a forwarded ref reaches a component that spreads its props" in the describe "refs forwarded through components" of packages/brumate/test/resume.test.ts, as a plain `it`.
- Changeset .changeset/spread-anchor.md, a patch for brumate.

## Deviations

- The fix is in packages/brumate/src/codegen/markup.ts, which the brief did not own. server.ts, html.ts and client.ts are untouched.
- The fix is not in the runtime files (server.ts, html.ts) that the brief owns. The runtime `spread` cannot drop the incoming `b-b`: a component with no anchor of its own needs it, for the `b-on` handlers of the dynamic tag. Only the order of the generated code can let the own anchor win.
- The client path has no test of its own. `dynamic` and `dynamicNodes` put `ref` into the props of a function tag, and the component renders through the same emitter, so the codegen change covers it. A test with a component in `as` inside a block that the browser renders cannot run: the component is a stub there and renders nothing (core-gaps.md section 2, component-prop-render). Add that test when component-prop-render lands.
- No change in packages/brumate/src/runtime/client.ts.

## Stubs left

- None.

## Gotchas

- An element with a spread now has `b-b` right after its tag name and scoped-class attribute, so the order of attributes changes in its HTML. No snapshot depended on it.
- The spread still writes the incoming `b-b` after, as a duplicate that the parser drops. When the element has no anchor of its own, the incoming one is the only one and stays.

- In browser-rendered markup, `keep` (client.ts, near line 3942) writes the own `b-b` only for the root of the clone and for elements with a `b-on`. A nested spread element with no handlers keeps the inherited `b-b`. That is unchanged from main, and harmless, since `keep` stores the element by its anchor directly.

## Proposed learnings

- When two generated attributes can name the same thing, write the one that must win first, because the browser keeps the first of a repeated attribute | the HTML parser drops later duplicates | packages/brumate/src/codegen | yes

## Verification

- Before the fix, `npx vitest run test/resume.test.ts -t "spreads its props"` timed out on main.
- After: that test passes. `npx vitest run` in packages/brumate: 55 files passed, 941 tests passed, 5 expected fail. `npx tsc --noEmit -p .` has no errors. `npx oxlint` and `npx oxfmt --check` from the root exit 0.

## Size

- Eager core, gzip, before and after: the client chunk 30715 bytes, the produce chunk 3876 bytes. The chunks have the same hashes, so the change is 0 bytes, inside the 0.1 kB budget. The change is in the compiler, not in the shipped runtime.
- Estimated S, actual S.
