---
'brumate': minor
---

`viewTransition="card"` and `viewTransitionName=(expr)` mark an element for a view transition. The core gives the marked elements in view a `view-transition-name` and `view-transition-class` only while a transition of `transition()` or of a client navigation with `transition: true` runs, and removes them when it ends, so lists slide and a picture can move from one page to another with no hand-written unique names. A build with no marked element has none of the code.
