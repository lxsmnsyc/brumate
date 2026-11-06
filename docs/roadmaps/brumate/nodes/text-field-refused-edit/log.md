# Log: text-field-refused-edit

- Read the TextField and SearchField sources. Both write `value = next` and call `onChange` only when the value changed. A refused write leaves the value, so no update runs and the input keeps the typed text.
- The setter promise is not visible to a component: `send` discards the result of `callNow` and `call`. Options: a timer (wrong for a slow check), or expose the promise. Chose a small hook, registered under a symbol like `flush`. First version also exported `settled()` from `brumate/signals`; the coordinator asked to keep it internal, so the export is gone and `fields.ts` reads the symbol.
- The first build grew todos by 81 B gzip. `track` and the registration now sit behind `HAS_BINDINGS`: todos is 39360 B against 39361 B on main.
- First e2e run failed with the caret at 2, not 0: Home does not move the caret in Chrome on macOS. The code was right (typed `12x`, caret 3, mapped to 2). Changed the step to ArrowLeft.
- Unit tests fail on main as designed, except async accept, which passes on both.
- Sizes (client gzip -9, clean rebuild, main files swapped in for "before"): ui 199354 to 199931 B, todos 39361 to 39360 B.
