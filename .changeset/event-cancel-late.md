---
'brumate': minor
---

`cancelWhen(element, type, check)` in `brumate/events` cancels a `click` or `submit` of an element before any handler runs. A `prevent` that is written after load now also cancels a delegated `click` or `submit`, which the document no longer listens to passively.
