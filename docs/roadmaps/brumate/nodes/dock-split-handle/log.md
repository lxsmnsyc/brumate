# Log: dock-split-handle

- The branch had no `split.ts`; `ctx.split` was still `splitPlain`. Built `createSplit(root)` and wired it in `devtools-panel.ts` (one import, one line).
- Handle is a zero-width flex item between the panes, so the callers' `.split > .list` and `.split > .detail` styles hold. CSS injected once as `style[data-split]`.
- Pointer capture on the handle; no window listeners. The minimums are also set as CSS (`min-width`, `max-width: calc(100% - min)`), because the box has no width when the size is set.
- Size stored as `brumate:devtools:split:<key>:<side>`, written on release and on key press, cleared by double-click.
- Tests: happy-dom, `clientWidth` set by hand on the box.
- One flaky run each of `test/devtools` (an unhandled error, once) and `differential-4` in the full run; both passed on rerun.
