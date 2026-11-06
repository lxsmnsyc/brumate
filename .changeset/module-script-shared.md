---
'brumate': patch
---

A component that the browser renders shares its `<script module>` state with the instances that resumed. The render module imported a copy of the module script, so each copy had its own state.
