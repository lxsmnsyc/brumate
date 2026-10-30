# Log: bind-read-your-writes

- Probe on main: `bindReadYourWrites.brm` (a child writes a bound prop with a rounding setter, then reads it) read `0`, the old value. Test `bound props read their writes` in `packages/brumate/test/resume.test.ts` fails on main.
- First try: `flush()` after `send` in `set`. Not enough: `send` called the setter through `call`, which always waits a microtask, so nothing was written yet.
- Fix: `callNow` in `client/references.ts` runs a loaded setter at once, as a pass, when no earlier call waits (a counter keeps the order of calls). `set` then calls `flush()` so the update of the prop runs before the write returns.
- UI: each part reads its value after the write and calls the handler with it, only when it changed. Selection parts, ComboBox, Select, Tabs, color parts, date and time parts included.
- TextField and SearchField keep their exception: writing the kept text into the native input would drop the typing of a setter that accepts later.
