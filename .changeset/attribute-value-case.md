---
'brumate': patch
---

Enumerated attributes in the element types take their keywords in lower case, upper case or capitalized, as HTML matches them without regard to case: `dir="LTR"`, `type="Submit"`. The empty string type-checks where HTML defines it as a state, such as `translate=""`, `contenteditable=""` and `popover=""`.
