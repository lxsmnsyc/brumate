---
'brumate': minor
---

`$produce` drafts `Map` and `Set`, in a signal and inside a drafted object. The map or set is copied on the first change, keeps the order of its entries and gives drafts of its values, and the old one is not changed. Keys are never drafted. In dev, `$produce` warns when the recipe changes an instance of another class and returns nothing.
