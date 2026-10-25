---
'brumate': patch
---

`prevent(handler, ...keys)` leaves alone a key that an input method gets while it composes text. Before, `prevent(submit, 'Enter')` stopped the Enter that ends a word in Japanese.
