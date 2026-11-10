# Outcome: dock-activity

## Built

`packages/brumate/src/runtime/devtools-panel/activity.ts` (about 560 lines) draws the Activity workspace as the prototype does.

- One log, oldest first, with rows of six kinds: Navigation, Block, Handler, Write, Effect, Server. Each kind has a filter chip, and Pause and Clear sit at the right. A ruler above the log has a tick for each row and round time marks (`tickStep`). Writes, effects and calls made while a handler ran hang under it.
- The log is in the first column of `ctx.split({ key: 'activity', ... })`. The detail is the second column. With no call selected it says "Select a server call to see what it sent and got back." A server call row shows its name, status and time from `CallTiming`. Clicking it (or Enter or Space) selects it, and the pane then holds `ctx.drawCallDetail(entry)` with a close button. Clicking the row again or the close button clears it.
- Exports: `activity`, `describe`, `handlerName`, `tickStep`. A call row reads its `CallTiming` from `entry.call`, which dock-call-detail adds to `DevtoolsEntry`, so this node depends on it (stacked on PR #500). Calls made outside a handler show their timing too.
- State is in `shell.work.activity`: shown kinds, pause time, clear time, selected entry, scroll.
- Removed: the log search, the checkbox filters, the Effects table, the Timeline bars, the Navigation cards and the Server trace table.

## Deviations

- `test/devtools.test.ts` (not owned) changed in four places, since its tests read the removed tables. The dropped assertions "IDs moved by 3" and "3 updates" covered views the prototype lacks (the navigation cards and the timeline bars): the log test clicks the Write chip and looks for `Counter save()` and the status `redirect → /done`; the effects test counts rows and the one marked bad; the navigation test reads the single log; the timeline test looks for `Cart h2` and `Cart save()`.
- The ruler keeps an adaptive scale (round steps over the range of the rows, since sessions run past 5 s) where the prototype fixes 0 to 5 s. Its labels read "Ns" from the first row, and the marks use `var(--line2)`.
- Pause and Clear are plain text `.chip` buttons, as in the prototype.
- The detail element is kept in `shell.work.activity` and reused while the entry and its call record are the same objects, so the detail keeps its own state; `drawCallDetail` runs again when the selection or the record changes.
- `style.ts` is untouched. The styles are a `<style data-activity>` in the shadow root, added once by `activity.ts`. Dock-shell can move them into `style.ts`.
- The prototype has no empty state for the detail pane of Activity, so the text above is mine.
- Pause and Clear are by time, not by `shell.frozen`, so all kinds follow them.

- `.panel.right .calld { width: auto; flex: 1 }` is in the Activity styles, so the 440px detail fits on the right edge.

## Stubs left

- `ctx.split` is still `splitPlain()`. `.split.activity > .list` is set to 58% wide in the Activity styles; dock-split-handle should set the width inline.
- `tabs` has five keys (log, timeline, effects, navigation, server) that all draw the one log. Dock-shell removes them.

## Gotchas

- For dock-shell: `devtools-panel.ts` skips redraws while paused on the log tab, so `pausedAt` only matters on the other tabs. Once the tabs go, the skip can go and `pausedAt` does the whole job.
- `shell.frozen` and `shell.logSearch` and the `script[b-trace]` data are unused now; dock-shell can drop them.
- The detail is reused while `entry`, `entry.call` and `entry.call.record` are the same objects.
- Effects show one row for each run in `effect.recent` (at most 50 for each effect). The newest row of an effect shows its run count and is marked bad at 10 runs in the last second.
- The old Server tab (the render trace of the last page) is gone; its `script[b-trace]` data is not read anywhere now.

## Verification

- `pnpm --filter brumate exec vitest run test/devtools-dock-activity.test.ts test/devtools.test.ts`: 18 passed.
- `pnpm --filter brumate typecheck` (after `pnpm --filter brumate build`): pass.
- `npx oxlint`: no errors, none in these files. `npx oxfmt --check`: pass.
- Not run: the full suite, `node e2e/run.mjs`.

## Size

- Estimated M, actual M.
