# Outcome: part-guides

## Built

- `website/ui/your-own-parts.md`: building a part with `press`, `hover` and `focusRing` (and `interact`), how to join their handlers, a table of the contexts of `packages/ui/src/contexts.ts` with the part that gives each and what it holds, how to read one with `$getContext` and `$store`, and how to give props to parts with a context and slots.
- `website/ui/demos/OwnPartDemo.brm`: a card that presses, hovers and shows its focus ring with the three functions.
- `website/ui/keyboard-and-focus.md`: each rule once, with the parts that follow it: one stop of Tab for a group, focus that stays in a field (`aria-activedescendant`), arrow keys and right to left, typing to find an item, focus in an overlay (in, once, trapped, back), Escape, and the focus ring.
- `website/ui/async-content.md`: what a Popover or a Modal does with a `#loading` or a `#defer` body, where focus goes, and how to load the content with `#loading` and a server function.
- `packages/ui/test/async-overlay.test.ts`, with the fixtures `packages/ui/test/fixtures/async-overlays.brm` and `async-overlay-late.brm`. Findings:
  - A Dialog in a Popover or a Modal that opens on a `#defer` body: focus goes to the Dialog, and the `#else` of the block stays for good.
  - A Dialog that opens on a `#loading` body that waits: focus goes to the Dialog and stays there when the body arrives. `autofocus` in the late body is not taken.
  - A `#loading` body in an overlay loads again each time the overlay opens.
- The three pages are in the Start group of the sidebar, after Layers.

## Gap found (proposed node)

- `#defer` in an overlay keeps its fallback. The browser renders the content of an overlay when it opens, and a `#defer` block that the browser renders keeps its `#else` (`website/docs/async-data.md`, "#defer"). The compiler reports nothing, since the block is in the children of a component from another file. The test `renders the #defer body of an overlay that the browser opens` in `packages/ui/test/async-overlay.test.ts` is `it.fails` and passes once fixed; flip it to `it` then.
- Proposed node: `defer-in-browser-render` (type fix or feature, core, not ui): either fetch the `#defer` body when the browser renders the block, or report the block at compile time across files (`analyzeProject`). The guide tells readers to use `#loading` with a server function until then.

## Proof

Not a fix node. The probe is the test above.

## Deviations

- `website/src/ui-groups.ts`: the sidebar list now lives here, not in `website/src/ui.ts` (the shared path of the brief). Added the three pages to the Start group.
- `website/test/ui-sections.test.ts`: added the three pages to `CONCEPT_PAGES`, since guides do not follow the section order of a part page.
- `packages/ui/test/fixtures/async-overlays.brm` and `packages/ui/test/fixtures/async-overlay-late.brm`: new fixture files for the owned test.
- No `Interactive` part (proposals.md #7 "Adopt"): the brief asks for the guides and the test only.
- No changeset: the change is docs and a test.

## Stubs left

- None.

## Gotchas

- `@brumate/ui` pages use plain `brm` fences, which `check:samples` does not compile (it compiles `brm live` only). The plain samples of the three pages were compiled once by hand with `compile` of `brumate`, resolving `@brumate/ui/*` to `packages/ui/src`. The demo compiles in `pnpm --filter website build`.
- `vitest` in `packages/ui` hides `console.log`; pass `--silent=false` to see it in a probe.

## Proposed learnings

- A `#defer` inside the children of an overlay part never loads | the overlay renders its content in the browser | packages/ui, website/ui | yes (async-overlay.test.ts)

## Verification

- `pnpm --filter @brumate/ui exec vitest run test/async-overlay.test.ts`: 4 passed, 1 expected fail.
- `pnpm lint`: pass (warnings only, none in changed files).
- `pnpm format:check`: pass.
- `pnpm typecheck`: pass.
- `pnpm --filter website check:samples`: 72 samples, 0 problems.
- `pnpm --filter website test`: 345 passed.
- `pnpm --filter website build`: pass. The built pages `/ui/your-own-parts`, `/ui/keyboard-and-focus` and `/ui/async-content` exist, the demo renders in the HTML, and the sidebar links them.

## Size

- Estimated M, actual M.
- Risk estimated low, measured low.
