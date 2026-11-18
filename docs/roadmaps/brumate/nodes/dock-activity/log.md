# Log: dock-activity

- The prototype has one log with six kinds (navigation, block, handler, write, effect, server), so the five old tabs become one view. The old tab bar stays until dock-shell, so `tabs` keeps five keys that all draw it.
- `style.ts` is not mine, so the Activity styles are one `<style data-activity>` that `activity.ts` adds to the shadow root once. First try put it in the body and it showed in `textContent`.
- Call rows come from `state.log` entries of kind `call`. `findCall` matches the `CallTiming` in `state.timeline` by name and by time (the entry is added right after `call.end`). A call no handler made has no timing, so its row reads status and time from the entry text.
- Handler rows come from the log; a timeline run with no log entry also gets a row.
- Pause and Clear no longer touch `shell.frozen`; they use times (`pausedAt`, `cleared`), so effects, navigations and blocks follow the same rule. Clear also empties `state.log` and `state.timeline`.
- Dropped as not in the prototype: log search, the effects table, the timeline bars, the navigation cards, the server trace table (`script[b-trace]`).
- Rebased on feat/dock-call-detail (a41dc68c). Removed the `findCall` time heuristic; rows read `entry.call`.
