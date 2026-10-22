---
'brumate': minor
---

`budget.event` fails the client build when the first run of one handler loads more than a size, and `budget.component` when one component ships more. The error names the component, the handler and its largest imports. `report: true` lists the largest handlers.
