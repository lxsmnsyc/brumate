---
'brumate': minor
---

- `prevent(handler, ...keys)` prevents a key alone only while Ctrl, Meta and Alt are up, so the shortcuts of the browser, such as Cmd+Left, keep working on an element that prevents the arrows. A key can name a modifier that must be held, such as `'Mod+ArrowDown'` for Ctrl or Meta.
- `prevent(handler, ...keys)` leaves alone a key that an input method gets while it composes text, such as the Enter that ends a word in Japanese.
