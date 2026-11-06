---
'@brumate/ui': patch
---

`TextField` and `SearchField` now show the kept text when the setter of `$bind(signal, setter)` refuses an edit. Before, the input kept the typed text until a reset. A setter that returns refuses at once. A setter that decides later, such as after an async check, leaves the typed text in place until its promise settles, and the field puts the kept text back only if the value did not take what was typed. A later keystroke cancels the check of an earlier one, and the caret stays where it still fits.
