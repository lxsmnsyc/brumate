---
'brumate': minor
---

- `viewTransition="card"` and `viewTransitionName=(expr)` mark an element for a view transition.
- Marked elements in view get `view-transition-name` and `view-transition-class` only while a transition runs, from `transition()` or from a client navigation with `transition: true`. They lose them when it ends.
- Lists can slide and a picture can move between pages with no hand-written unique names.
- A build with no marked element ships none of this code.
