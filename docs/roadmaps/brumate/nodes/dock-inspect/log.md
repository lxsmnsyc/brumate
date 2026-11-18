# Log: dock-inspect

- The branch base lacks the brief of this node and the story brief's later edits; read them from main.
- The old tab bar stays until dock-shell lands, so `tabs.scopes`, `tabs.elements` and `tabs.graph` all draw the one view. The Graph tab opens it in the graph view; the switch moves `shell.tab` back to `scopes`.
- The prototype has no Elements pane: Pick selects the component's row (it sets `selectedScope`, the entry does that already). The Elements detail (anchor, handlers, markers) is dropped. Handlers show as values of type function.
- Old class names `tree-row`, `slot` and `value` stay, so `test/devtools.test.ts` keeps working. Only the Elements test changed.
- Reads of the prototype's value rows come from `readers` of the dev server's scope plan. The reads cell sits outside `div.slot` (which is `display: contents`) so the slot text stays name, type, value.
- Focus: every control that must survive a redraw has `data-focus`. The draw records the focused one and restores it (with the caret of a text field). Actions can ask for a control with `work.focus`.
- Folding a row selects it, so the selection never hides inside a folded row. Ancestors of the selected scope stay open.
- Graph view calls `ctx.drawGraph(component, info)` only. With #504 the context form is `(scope, info)` too, so nothing here changes then.

- Review fixes: the tree keydown ignores the filter input and moves from the focused row. `findCurrent` keeps the last seen scope and module in `InspectWork`. Values are always-present inputs committed on `change`; `shell.editing` is no longer set. The Graph switch was checked on the real #504 `drawGraph` (`.ins .graph svg`), and the `svg g.node.hot` test in `devtools.test.ts` passes.
