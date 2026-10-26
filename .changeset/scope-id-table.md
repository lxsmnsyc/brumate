---
'brumate': patch
---

The fields of a state record and the reference classes that hold a scope ID are in one table, `SCOPE_IDS` in `shared.ts`. Moving a page's IDs for client navigation reads it, so a new field of the record fails to compile until it is in the table. `Binding` is not covered yet.
