---
'brumate': patch
---

The fields of a state record and the references that hold scope IDs are in one table, `SCOPE_IDS` in `shared.ts`. Moving a page's IDs for client navigation reads the table, so a new field cannot be missed.
