# Log: dock-page

- Read the prototype's Page workspace: four metrics, then two columns (what the browser loaded and blocks; environment and two actions).
- page.ts rewritten: one `drawPage` draws the whole workspace. The old tabs overview, state and blocks all point to it, so the tab bar and devtools.test.ts keep working until dock-shell removes the bar.
- Report removed: page.ts, the `report` tab in devtools-panel.ts (one TABS line and the comment), the `report` member of `Tab` in workspace.ts.
- The first draw is sync, and a second draw follows when component names load from the dev server (the Blocks test clicks and reads at once).
- devtools.test.ts: one assertion changed (the components table is gone).
