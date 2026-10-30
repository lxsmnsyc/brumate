---
'brumate': patch
---

A client part imports the names its code uses. The shared part of a component imports a helper that its functions call when the component imports it in `<script module>`, and the update part imports the components that a template passed as a prop renders, such as `cell=day`. The browser no longer throws `ReferenceError: sameKeys is not defined` in ToggleButtonGroup and CheckboxGroup.
