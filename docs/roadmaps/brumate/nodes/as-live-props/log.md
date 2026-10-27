# Log: as-live-props

- Test first: gapPropsComponent timed out on main, gapPropsElement passed.
- project.ts: a usage with an attribute that names a `.brm` import (`as=Target`) now sends the live props of the callee's dynamic tags that read that prop to the import.
- The first version broke 12 ui tests: a part's scoped style attribute (`Internal(true)`) landed in a live rest and the page state could not send it. Added `InternalPlugin` (serial.ts) and `stateValues.i` (shared.ts).
- spikePage test matched `<a class=...` first; the link now has `b-b` before `class`. Loosened to a regex.
- ToggleButton it.fails stays: it passes `as` on to Button and uses a spread.
