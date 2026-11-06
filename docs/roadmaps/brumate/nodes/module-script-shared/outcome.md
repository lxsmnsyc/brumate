# Outcome: module-script-shared

## Built

- packages/brumate/src/codegen/render.ts: the render module imports the module names that it reads from the shared part (`./X.brm?brumate-client&part=shared`) and re-exports the exports of the module script. It no longer copies the module script. `rendersModule` tells if the render reads a module name.
- packages/brumate/src/codegen/client.ts: `usesModuleScript` is also true when the render reads a module name, so the shared part exists for a component whose markup alone reads it.
- Tests: packages/brumate/test/resume.test.ts with test/render/ModuleBox.brm, moduleBoxHost.brm, moduleBoxLateHost.brm (a resumed and a browser-rendered copy share `box`; two copies that only the browser renders share it); test/shared-part-imports.test.ts (render output). Both resume tests fail on main (`0:0` where `1:0` is right).
- Five render snapshots (doubler, loading, memos, retry, shared) now show the import from the shared part.
- .changeset/module-script-shared.md (patch).

## Deviations

- None. The brief says `bridge()` exports if they exist on main: no `bridge` exists in packages/brumate/src.

## Stubs left

- None.

## Gotchas

- Module-scope server functions are still `rpc` stubs in the render module, not exports of the shared part. They hold no state.
- `export { a }` specifier lists in a module script are not re-exported by the render module (the shared part does not handle them either).
- A component with module exports whose render reads one gets a shared part. Server-only reads in markup do too.

## Proposed learnings

- The module script lives in the shared part only. A new module of client code imports it from there, never copies it.

## Verification

- Exit 0: packages/brumate (`--hookTimeout=120000 --maxWorkers=3`), language-server, vscode, hackernews, kit-app, nitro, todos, tracker, ui-kit, website; ui e2e (55 passed); root oxlint; oxfmt --check on changed files; brumate typecheck.
- packages/tsc, packages/ui: timeouts under load pass alone (tsc, calendar). ui `token-field-sync` fails on main as well (4 of 5 on main, 1 of 5 with the change); it belongs to text-field-refused-edit.

## Size

- Estimated M, actual S.
- Client gzip (sum of dist/client/**/*.js, gzip -9), clean rebuilds, main vs head: todos 39,369 -> 39,364 B (-5), ui 199,363 -> 199,350 B (-13).
