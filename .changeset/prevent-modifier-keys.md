---
'brumate': patch
'@brumate/ui': patch
---

`prevent(handler, ...keys)` prevents a key alone only while Ctrl, Meta and Alt are up, so the shortcuts of the browser, such as Cmd+Left or Alt+Left, keep working on an element that prevents the arrows. A key can name a modifier that must be held, such as `'Mod+ArrowDown'` for Ctrl or Meta. ListBox, GridList, Table and Tree prevent the keys that they move with while Ctrl or Meta is held.
