# Log: module-script-shared

- Probe: `ModuleBox.brm` (`const box = { n: 0 }`, signal `t`, `<p>{box.n}:{t}</p>`, button `t = ++box.n`) in a host with a resumed copy and an `#if` copy. On main the second copy shows `0:0`, not `1:0`. The render module held its own copy of `box`.
- Cause: `generateRender` called `clientModuleScript`, which copied the module script statements into the render module when the markup read a module name.
- Fix: the shared part of the client entry (`?brumate-client&part=shared`) already holds the module script, and the handler parts import from it. The render module now imports the module names that it reads from that part and re-exports the exports of the module script (other modules import them from the render module, as they did from the copy). Module-scope server functions stay as local `rpc` stubs, which hold no state.
- The shared part existed only when a client site or a rendered scope read the module. A component whose markup alone reads it (no handler) had none, so `usesModuleScript` in codegen/client.ts is also true when a site of the render reads a module name (`rendersModule` in codegen/render.ts).
- Imports of the module script that the render does not read no longer go into the render module (before, all of them did when it read any module name).
- First try re-exported the module exports for every component. That pulled the shared part of `export const cache = ...` into components that never read it, so the re-export only happens when the render reads a module name, as the copy did.
- Hit: `spreadChildrenStream` failed (`Shown` undefined) until the re-export was added. That is the check for exports.
- Tests: resume.test.ts (resumed + browser copy; browser-only, two blocks), shared-part-imports.test.ts (compile output). Five render snapshots changed: render modules import from the shared part.
- Full brumate run: two flakes under load (testing-a11y, tsc test, ui calendar timeouts) pass alone. ui token-field-sync fails on main too (4 of 5 on main, 1 of 11 with the change).
- Sizes (gzip -9 of dist/client/**/*.js, clean rebuilds): todos 39,369 -> 39,364, ui 199,363 -> 199,350. Builds of the same source differ by a few bytes.
