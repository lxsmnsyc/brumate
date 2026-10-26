# Outcome: component-tag-live-props

## Built

- A live prop of a dynamic tag that names a component, such as `<{as} label=(label) />` with `as` set to a component, reaches the component when it changes. The tag is rendered by the server, or in a block that the browser opens.
- Runtime, `packages/brumate/src/runtime/client.ts`: `dynamicNodes` reads the anchor from the tag's `b-b` and passes it to `componentNodes`, which records the child scope in `scope.c[anchor]`. `attr` calls `prop` when that anchor holds a child scope. `dynamic` calls `dynamicNodes` for a component tag, where it repeated that code.
- Runtime, `packages/brumate/src/runtime/server.ts`: `dynamic` passes the same anchor to `component`, so the page state holds the link (`c`) of a tag that the server rendered. It takes `b-b` out of the props, so a component that spreads `...rest` does not hold an `Internal` in a live rest slot.
- Runtime, `packages/brumate/src/runtime/serial.ts`: `InternalPlugin` writes an `Internal` (a `b-on` that a spread passes on) as `void 0` in the page state, because the browser writes its own. It matches by constructor name, as a page can render with another copy of html.ts. The core does not import serial.ts.
- Project analysis, `packages/brumate/src/project.ts`: `summarize` marks a dynamic tag's usages with `dynamic`. `analyzeProjectProps` gives a live value prop of such a tag only to the `.brm` imports that the file reads as a value and whose props declare that name (a named prop, the rest, or the props object).
- Tests: `packages/brumate/test/resume.test.ts`, describe "a dynamic tag that names a component", two tests. Fixtures `componentTagLiveProps.brm` and `componentTagLivePropsLate.brm` in `test/render/`, with the existing `Tag.brm`. Review fixes: `restTagLiveProps.brm`, `restTagLivePropsLate.brm` and `RestLink.brm` (a copy of AsLink, which spreads its rest) with a live `title` and a `class` object, on the server and in a block, and a project test that `Other` (no `label` prop) gets no live props.

## Deviations

- Edited `packages/brumate/src/runtime/server.ts` and `packages/brumate/src/project.ts`, which are outside the brief's paths. The link needs the anchor in the page state, and the live props need the project analysis. Both changes are small.
- Added `RestLink.brm` beside AsLink, because a live rest on the shared AsLink breaks other tests (see Gotchas).
- Added the fixture `componentTagLivePropsLate.brm` for the block case, beside the owned `componentTagLiveProps.brm`.
- The repro of the brief (`class=(cls)` on `AsLink`, which spreads its rest) passes on main. The failing case is a component that names the prop.

## Stubs left

- None.

## Gotchas

- The live props go to every `.brm` import that the file reads as a value and whose props declare the name, not only to the component that the tag names at run time.
- Gap 1: a component reached through a `.ts` re-export, or through a parent's prop, keeps static props. Repro: `Q.brm` has `const { as } = $props(); <{as} label=(label) />` where `label` is live, and a page has `<Q as=T />`. Q does not read `T` as a value import, so T gets no live `label`.
- Gap 2: a spread, a live handler or a computed attribute on a component tag goes through `attrs` and stays static. Repro: `<{as} {...props}>`, `<{as} onClick=(handler)>` or `<{as} [name]=(x)>` with `as` set to a component and the value changing. Only value props go through `prop` now.
- Found, not caused by this node: a component whose rest props are live, such as AsLink once any page passes it a live prop (`<AsLink title=(String(flag)) />`), breaks `a component in a prop` tests on origin/main as well. The handler of a tag in a block that the browser renders reads an undefined scope (`get` in client.ts, from `LateAs.brm`'s `h6`). Repro: add a fixture with a named `<AsLink title=(String(flag)) />` to test/render, and run `-t "a component in a prop"`. That is why the new fixtures use `RestLink.brm`. It needs its own node.
- The client keeps `b-b` in the props of a component tag, because the handlers of the tag find their scope by the element's `b-b`. The server takes it out, as its entries carry `@scope`.

## Proposed learnings

- A dynamic tag that can name a component needs the same link and live props as `<Name>` | the project analysis cannot see the target | packages/brumate/src | no

## Verification

- `npx vitest run test/resume.test.ts -t "updates its live props"` in packages/brumate: both tests fail before the change (the first one timed out in the wait for the new text), pass with it.
- `npx vitest run` in packages/brumate: 963 tests passed, 5 expected fail.
- `npx vitest run --maxWorkers=2` in packages/ui: exit 0.
- `npx tsc --noEmit -p .` in packages/brumate: exit 0.
- `npx oxlint` and `npx oxfmt --check` from the root: exit 0 (oxlint with warnings only).

## Size

- Gzip of `client-*.js` from `npx tsdown`: 30856 B on origin/main, 30898 B with the fix, +42 B (0.04 kB), within 0.05 kB. `produce-*.js`: 4013 B before and after.
- Estimated S, actual S.
