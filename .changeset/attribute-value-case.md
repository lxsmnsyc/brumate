---
'brumate': patch
---

Enumerated attributes in the element types take their keywords in any letter case, as HTML matches them: `dir="LTR"`, `type="Submit"`. The empty string type-checks where HTML defines it as a state, such as `translate=""`, `contenteditable=""` and `popover=""`.
