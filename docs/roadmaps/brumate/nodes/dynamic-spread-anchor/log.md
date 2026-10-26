# Log: dynamic-spread-anchor

- Wrote the fixtures RefSpread.brm and refForwardSpread.brm and the test of core-gaps.md section 1. On main it times out: the HTML has two `b-b`, and the browser keeps the first, the one of the dynamic tag.
- The cause is the order in `emitElement` (src/codegen/markup.ts): the element's own `b-b` was written after the spreads. Runtime `spread` cannot drop the incoming `b-b`, because a component with no anchor of its own needs it for the handlers of the dynamic tag.
- Fix: with a spread on the element, write the own `b-b` first. The same emitter writes the client renders, so the browser path gets it too.
- Client path: `dynamic` and `dynamicNodes` pass `ref` into the props of a function tag, and the component's client render is the same emitter. A test for a component in `as` inside a block the browser renders cannot run yet: the component in a signal or constant is a stub that renders nothing (core-gaps.md section 2, component-prop-render). Tried it, the block opens empty.
- Suite, tsc, oxlint and oxfmt pass. The `produce-*` and `client-*` chunks have the same hash after the change.
