---
'brumate': patch
---

Fix `prevent(handler, 'Mod+K')` so a letter after a modifier matches in either case. It matched only Cmd+Shift+K before, because the browser sends `k` for Cmd+K.
