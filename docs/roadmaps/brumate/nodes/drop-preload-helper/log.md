# Log

- 2026-11-01: Checked first: the work did not exist. `build.modulePreload: false` already ships the helper, and Vite 8 wraps every `import()` in its native import-analysis plugin.
- `/* @vite-ignore */` on the bundle imports stops Rolldown from resolving them, so it is no switch.
- No option turns the wrapper off. The helper module `\0vite/preload-helper.js` is served by a `load` hook, so a plugin that runs first can serve its own. Used that instead of a `renderChunk` rewrite: no regex on Vite's output.
- `resolveDependencies: () => []` leaves only stylesheets in the dependency arrays, so `__vite__mapDeps` holds CSS files only (none on the website, todos, dashboard, rows).
- Chrome check of a lazy chunk with a stylesheet served 300 ms late: the chunk ran styled, on base `/` and `./`. Found a bug there (`new URL` with three arguments on a relative base), fixed.
- Measured website entry and todos on main and on the branch (outcome.md).
