# Log: dock-issues

- Kept `drawErrors` and `tabs: { errors }` because the old tab bar still reaches it; dock-shell removes `tabs`.
- Prototype maps Compiler check to yellow and browser/server errors to red, so `compile` entries get a yellow dot.
- The prototype has no Clear button, so it is dropped. `state.errors` can no longer be emptied from the panel. Doubt: the maintainer may want it back.
- Selection keeps focus: rows and frames carry `data-key`, and the draw refocuses the same key. ArrowUp and ArrowDown move the selected issue (the target key goes in `shell.work.issues`).
- Styles are in a `<style data-issues>` added once from issues.ts. Used `--sel`/`--ring` locally under `.issues`; the panel has no such variables yet.
- Old `.error-row` styles in style.ts are now dead (style.ts belongs to dock-shell).
- Review fixes: hint box and BRM code from `error-catalog.ts` (lazy import, pure module); focus keys by `time` plus a counter for equal times; arrow keys return on a stale selection; `--sel` and `--ring` taken from the prototype root (orange tint), not the hover grey; plugin name dropped from the row.
