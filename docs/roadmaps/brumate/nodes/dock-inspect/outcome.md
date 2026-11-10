# Outcome: dock-inspect

## Built

The Inspect workspace in `packages/brumate/src/runtime/devtools-panel/inspect.ts`, as `prototype/index.html` draws it.

- Left, a filter and the component tree: indent guides, a chevron that folds a component's scopes, the name (blocks in purple mono), a heat dot that lights when the scope was written, and the scope count. Hovering a row outlines its elements on the page.
- A selected row is a filled rounded row with a soft ring (`--sel`, `--ring`), with no coloured left edge.
- Right, the detail: the component name, its file as an open-in-editor link, a Values | Graph switch, tags (scope id, scope count, hidden), and either the values or the graph.
- Values: a grid of name, type, value and what reads it (`readers` of the dev server). A value that JSON can hold is an always-present input that commits on `change` (Enter, or the focus leaving) through `state.set`; Escape restores the text (the old `editable` and `parseValue` rules). `shell.editing` is not used. A draw waits while the typed text differs from the committed one.
- Graph: `ctx.drawGraph(component, info)`, the only call into the graph.
- Keyboard: Up and Down move the selection from the focused row, Left and Right fold and unfold it. The filter keeps its own keys. The focused row, the Values or Graph button, the filter (with its caret) and an edited value keep the focus across a redraw (`data-focus`).
- `findCurrent` (exported, tested) remembers the scope and module of the last draw: a changed `shell.selectedScope` (Pick, the call detail) wins, else a changed `shell.selected` (Page, a module select) picks that module's first instance.
- State is in `shell.work.inspect`. The styles are one `<style data-inspect>` in the shadow root.
- Tests: `packages/brumate/test/devtools-dock-inspect.test.ts` (17 tests).

## Deviations

- Block rows (the scopes of `#for` and the like) are selectable, since they hold values; the prototype's block rows are not.
- The prototype's mock tags (`resumed`, `#defer`, `code loaded on first click`) are not drawn: the dock has no such data.
- `devtools.test.ts` also changed in the value edit test (a value is an input now).
- `packages/brumate/test/devtools.test.ts` (outside the owned paths): the test "shows a picked element with its place, its handlers and what it reads" expected the Elements pane, which the prototype does not have. It is now "selects the row of the component that renders a picked element". This file must go in a PR, not a direct commit.
- The old Elements pane (anchor, scope, handlers, markers inside) is removed, as the prototype has none. `drawHandlers` and `drawElements` are gone.
- The old tabs `scopes`, `elements` and `graph` still exist in the bar (dock-shell removes them) and all draw this view; the Graph tab opens the graph view.

## Stubs left

- None. `ctx.split` is still the plain two columns until dock-split-handle; the split key is `scopes`.

## Gotchas

- The styles define `--sel`, `--ring`, `--accent-text`, `--bg2` and `--line2` on `.ins`. Dock-shell should move them to the panel and drop the local copies.
- The Graph view draws through `ctx.drawGraph(component, info)`, the #504 graph. The `svg g.node.hot` test in `test/devtools.test.ts` passes through the Graph tab.
- The entry clears `state.written` after a draw only while `shell.tab === 'scopes'`; the heat dot lights then. Dock-shell should clear it after each Inspect draw.
- A `state.changed` redraw rebuilds the body; the focus is restored by `data-focus` inside this workspace only.
- `.ins` styles override `.tree-row` rules of `style.ts` by order (the `<style data-inspect>` comes later). Dock-shell can delete the old `.tree-row`, `.slots` and `.written` rules.

## Proposed learnings

- None.

## Verification

- `pnpm --filter brumate exec vitest run test/devtools`: 8 files, 79 passed.
- `pnpm --filter brumate typecheck`: pass. `npx oxlint`: no errors, none in the changed files. Root `npx oxfmt --check`: pass.
- `pnpm --filter brumate exec vitest run test/devtools-dock-inspect.test.ts test/devtools.test.ts`: pass.

## Size

- Estimated M, actual M.
