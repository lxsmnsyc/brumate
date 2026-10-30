---
'@brumate/ui': patch
---

SelectionIndicator takes a transition timing function with commas, such as `cubic-bezier(0.2, 0, 0, 1)` or `steps(4, end)`. It was cut at the first comma, and `animate` threw.
