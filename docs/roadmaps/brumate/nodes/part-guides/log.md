# part-guides log

- 2026-11-25: none of the three guides existed (`website/ui` has no your-own-parts, keyboard-and-focus or async-content page). Started from scratch.
- Probe, `packages/ui/test/async-overlay.test.ts` with the fixtures `async-overlays.brm` and `async-overlay-late.brm`:
  - A Popover or a Modal whose Dialog holds `#defer`: focus goes to the Dialog, and the `#else` stays for good. The browser renders the overlay's content when it opens, and a `#defer` that the browser renders keeps its fallback (documented in `website/docs/async-data.md`). The compiler reports nothing, since the block is in the children of another file. Gap: kept as `it.fails`, proposed as a node in the outcome.
  - A Dialog whose body is a `#loading` that waits for a memo in the browser: focus goes to the Dialog while the fallback shows, and stays there when the body arrives. `autofocus` in the late body is not taken. This is the rule "focus is taken once", documented, not a gap.
- The sidebar list moved from `website/src/ui.ts` to `website/src/ui-groups.ts`, and `website/test/ui-sections.test.ts` lists the guide pages that skip the order of sections. Both need the three pages: deviations.
