# Outcome: devtools-copy

## Built

- `packages/brumate/src/runtime/devtools-panel/copy.ts`: `writeIssue`, `writeComponent`, `writeRun` (Markdown with labelled lines and fenced blocks, the style of the server call), `scrub`, `cutSource`, and the moved `cutLong`, `printValue`, `writeForAgent`, `copyText`. `drawCopyTool` (labelled) and `drawCopyRowTool` (icon only) build the buttons. Classes are `dock-copy` and `dock-copy-row`.
- Inspect: a "Copy for an agent" tool button in the detail header, before the Values | Graph switch. It copies the file, the slots of each scope by name, components inside, contexts (`v`, `x`) and the `brumate inspect` report.
- Issues: the existing button now uses `copyText` (instant "Copied") and writes the message, component and place, source around the line (from the dev server, else the Vite frame), stack, and brumate and Vite versions.
- Activity: an icon button on each handler row with a matched run. It copies the event, handler, times, writes, updates and server calls with times.
- Values are cut at 1000 characters, a value in a component list at 300, source lines at 200. Keys named cookie, headers or authorization and lines that start with a cookie or authorization name are replaced by `[left out]`.
- `.changeset/new-dev-dock.md`: one line added.
- Test: `packages/brumate/test/devtools-copy.test.ts`, nine tests: each format, cuts, no cookie or header value, and a click on each button.

## Deviations

- `packages/brumate/test/devtools-dock-call-detail.test.ts`: import of `cutLong`, `printValue` and `writeForAgent` now from `copy.ts`.
- The error copy has no scope values: an error entry holds no scope, so there is nothing to read.
- The server call's text kept its labelled-line form, so its tests did not change.

## Stubs left

- None.

## Gotchas

- Activity has no handler detail pane, so the handler copy is a row button. A handler row whose run is not in the timeline yet has no button.
- A copy button replaces its children with "Copied" for 1.2 s. A redraw of the workspace during that time puts the normal button back early.

## Proposed learnings

- Pass every text that leaves the dock through `scrub` | cookies and headers must not reach an agent | packages/brumate/src/runtime/devtools-panel | yes

## Verification

- `pnpm install`, `pnpm --filter brumate build`: pass.
- `pnpm --filter brumate exec vitest run test/devtools`: 12 files, 118 tests pass.
- `pnpm --filter brumate typecheck`: pass. `pnpm lint`: 0 errors (warnings only, two in the new test about function scope were fixed). `pnpm format:check`: pass.
- `pnpm --filter brumate exec vitest run`: 93 files, 3129 pass, 1 skipped.
- Browser check of examples/tracker, bottom and right: done by the maintainer in Chrome. Inspect and Activity buttons work and show "Copied".
- Fix round 1: scrub runs on strings before JSON escapes them and also matches quoted keys, `x-auth-token`, `x-api-key` and `proxy-authorization`; `Error` copies as name and message, `Headers` as `[headers]`; the button shows "Copying", then "Copied" or "Copy failed" (text area fallback); Issues draws at once and reads the source on click.
- Fix round 2: keys match by a word in the name (cookie, authorization, header, token, secret, password, api key, csrf); header pair lists and `Bearer` tokens are blanked; the text area fallback gives the focus back; only the newest click ends the feedback; the write starts inside the click with a `ClipboardItem` promise when the browser has one.

## Size

- Estimated M, actual M.
