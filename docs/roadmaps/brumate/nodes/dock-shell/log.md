# Log: dock-shell

- Read the brief, the prototype chrome (grip, header, nav, footer, palette) and the dock-split outcome.
- The grip lives in `devtools.ts` (loaded before the dock): restyled to the prototype, "N issues" badge.
- Chrome in `shell.ts`, search in `search.ts`, the entry keeps open/close, side, size, keys, Pick and the draw loop.
- The 13-tab bar is gone. `Workspace.tabs` and `shell.tab` stay, because `workspace.ts` is not owned here and the workspaces still read them.
- Tests that clicked `[data-tab=...]` now use `openPanel(shadow, state, tab)` or the nav.
