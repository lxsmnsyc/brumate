# Outcome: dock-issues

## Built

`packages/brumate/src/runtime/devtools-panel/issues.ts` draws the Issues workspace as the prototype does. `packages/brumate/test/devtools-dock-issues.test.ts` covers it (3 tests).

- The list is on the left of `ctx.split`. Each row has a source dot (red for browser and server errors, yellow for compiler checks), the first line of the message and the place or time. The selected row is filled with a soft ring, with no coloured edge.
- The right side has the full message, the open-in-editor link, the highlighted code with the failing line (`codeView`, highlighter still loaded lazily), the frames of the stack, and the actions Open in editor, Copy for an agent, and Show in Activity (browser errors only).
- The nav badge count is still drawn by the entry (`drawChrome`), unchanged.
- The row shows `source · BRM code` (code from the `[BRM…]` suffix or the catalog). Under the stack a `.hint` shows the cause of the catalog entry (`findError`) with a Docs link. `error-catalog.ts` has no imports and loads lazily with `import()`.
- Focus keys use the time of the issue, so a new error does not shift them.
- Keyboard: ArrowUp and ArrowDown move the selected issue. Rows and frames carry `data-key`, and the draw focuses the same key again, so a click or key press does not lose focus.
- Styles are a `<style data-issues>` added once from `issues.ts`.

## Deviations

- No file outside the owned paths was edited.
- The Clear button of the old tab is removed because the prototype has none. Errors can no longer be cleared from the panel.
- `tabs: { errors: drawErrors }` stays until dock-shell removes `tabs`.

## Stubs left

None.

## Gotchas

- Browser errors do not open the panel by themselves; server and compile errors do.
- `.error-row` rules in `style.ts` are now unused; dock-shell can delete them.

## Verification

- `pnpm --filter brumate exec vitest run test/devtools-dock-issues.test.ts test/devtools.test.ts`: pass.
- `pnpm --filter brumate exec vitest run test/devtools`: 5 files, 42 tests pass.
- `pnpm --filter brumate typecheck`: pass. `npx oxlint`: no errors (warnings are in other files). Root `npx oxfmt --check`: pass.
- Not run: the e2e suite.

## Size

Estimated M, actual S to M: one module rewrite of about 300 lines and a test.
