# Log: color-area-page-keys

- Ran `node e2e/run.mjs --only ui` on main: the ColorArea step fails with `expected hsb(210, 51%, 71%), got hsb(210, 0%, 71%)`.
- Logged the events in the page: PageDown works. State stays `hsb(210, 51%, 71%)` for 2.5 s. The failing wait is the one after `Home`, a few lines later in the step. The brief named PageDown by mistake.
- After Shift+ArrowRight the focus is on the x input. Home sets the axis of the focused input to its minimum, so x goes to 0%. The step expected 51% (Home as "x down by a page").
- Cause: 03f9ed2c (2026-10-28, "keys of ColorArea and date fields") changed Home and End from a page on x to the ends of the focused axis. It updated the unit test and website/ui/color-area.md, not the e2e step or the JSDoc line in ColorArea.brm. The a9a3c875, c6c7c914 and 469de29b commits are not involved.
- No unit test can fail: color-area.test.ts "sends Home and End to the ends of the range" already covers the code. A test of the PageDown sequence passed on main too, so I did not keep it.
- Fix: the e2e step expects `hsb(210, 0%, 71%)` after Home; the JSDoc says what Home and End do.
- With the Home step fixed, the next step failed for the same cause: "ColorPicker: a change in the area" expected `hsb(210, 60%, 80%)` after End (a page on x). It now expects `hsb(210, 100%, 80%)`.
