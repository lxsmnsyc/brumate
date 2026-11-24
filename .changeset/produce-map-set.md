---
'brumate': minor
---

- `$produce` drafts `Map` and `Set`, in a signal and inside a drafted object.
- A drafted map or set is copied on the first change and keeps the order of its entries. The old one is not changed.
- Values of a map or set are drafted. Keys are never drafted.
- In dev, `$produce` warns when the recipe changes an instance of another class and returns nothing.
