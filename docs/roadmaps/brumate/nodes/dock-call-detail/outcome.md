# Outcome: dock-call-detail

## Built

- `packages/brumate/src/runtime/devtools-panel/call-detail.ts`: `drawCallDetail(ctx, entry)` draws the detail of a server call as the prototype does: title with status and total time, "Called by" (the interaction of the timeline), Arguments, Result or "Error on the server" (message, app frames from `stack.ts`, a count of hidden library frames, an editor link and the code of the chosen frame), Timing (bar and legend of module, network, server, decode), "On the server" (`read`, `called`, console lines), "After the call" and the actions. A part with no data is hidden. Long texts are cut at 1000 characters on screen, and values fold at depth 2.
- Actions: Run again arms first (button turns to "Run it again", a note says its side effects happen again, Cancel appears), then posts the same request through the page's `fetch`, so it shows as a new call. Copy as fetch and Copy for an agent copy to the clipboard and show "Copied". Exported builders for tests: `writeFetch`, `writeForAgent`, `printValue`, `cutLong`, `findOwner`, `findWrites`.
- The entry wires it: `drawCallDetail: (entry) => drawCallDetail(ctx, entry)` in `devtools-panel.ts`.
- Test: `packages/brumate/test/devtools-dock-call-detail.test.ts` (12 tests, fake records).

What dock-activity must call to open the detail: `ctx.drawCallDetail(entry)` with a `DevtoolsEntry` of kind `call`. It returns an element (`div.calld`) to put in the workspace; it needs `entry.call`. The detail does not fill itself in later: when the record arrives (`state.changed`), the Log must draw the detail again. The stub for now is the current Log code in `activity.ts`, which appends the detail under the list on a row click.

## Deviations

- Touched `packages/brumate/src/runtime/devtools.ts` (not in the owned list): `DevtoolsEntry.call?: CallTiming` set on both `add` calls of the fetch wrapper, and `CallTiming.request?` (`url`, `headers`, `body`) filled before the fetch. Without them the detail cannot find the call of an entry (calls outside a handler are stored nowhere) and cannot replay it (the record's arguments are cut). `request.headers` keeps only `content-type` and `x-brumate-*`, never cookies. The frozen `CallRecord` is unchanged.
- Touched `packages/brumate/src/runtime/devtools-panel.ts` (the entry) for the one line that swaps the stub, as `dock-split` planned.
- "Copy as fetch" has no `headers` key for a JSON call (a Blob carries the type). A form post that carries files needs `x-brumate-args: form`, so that one header is written. No cookie or other header ever is.
- "After the call" is a time window over the log (300 ms after the answer), since the record does not link a result to its writes.

- Review round 1, against the prototype's `callDetail`:
  - No path line under the title. `dock-call-record` v2 and the RPC id carry only the function name, not its file, so there is nothing to show. A later node could add the file to the record.
  - No close button. dock-activity adds one beside the detail; a second here would double it.
  - "Called by" is the prototype's link when the page still has the component of the handler (`Interaction.ref` matched to a root scope by `m`): it sets `shell.selectedScope` and calls `ctx.select('inspect')`. Otherwise it is plain text.
  - A call with no console output, reads or calls hides "On the server" (the brief says a part with no data is hidden), where the prototype shows "console no output".
  - Styles are the prototype's rules. `--bg2`, `--line2` and `--pink` are set on `.calld` with the prototype's values, since `style.ts` is dock-shell's.
  - The prototype's `.calld` is 440px wide in the side-by-side layout. It stays 440px here, so dock-activity may need to override it for the dock on the right edge (`.panel.right .calld { width: auto; flex: 1 }`).
- Review fixes made: `printValue` marks only an object that is its own ancestor (the same object twice prints twice), the error is a `.lines` block with a red `.errline`, the "reloads" label is "read", `fill`, `show` and `setArmed` are function declarations (`fillStack`, `showFrame`, `armRun`), and a failed stack shows "Could not read the code.".

## Stubs left

- None.

## Gotchas

- `CallTiming.request.body` keeps a FormData with its files in memory, in dev only, for as long as the log entry lives (`MAX_LOG`).
- The detail is built once. If the Log redraws on `state.changed` it drops an open detail, so dock-activity should keep the selected entry and call `drawCallDetail` again on each draw.
- Server stack frames are file paths, so `mapFrames` leaves them as they are; the source view uses `/__brumate/source`.
- A call that failed at `fetch` has no record: only the title, Called by, After the call and the actions show.
- dock-docs still has to warn that the dev header shows server errors to other machines (from dock-call-data).

## Proposed learnings

- None.

## Verification

- `pnpm --filter brumate exec vitest run test/devtools-dock-call-detail.test.ts test/devtools.test.ts test/devtools-calls.test.ts`: 34 passed.
- `pnpm --filter brumate typecheck` (after `pnpm build` in the worktree): pass.
- `npx oxlint`: no errors, none in my files. Root `npx oxfmt --check`: pass.
- Not run: the full suite and `node e2e/run.mjs`.

## Size

- Estimated M, actual M.
