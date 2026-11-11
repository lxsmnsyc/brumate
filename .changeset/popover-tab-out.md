---
'@brumate/ui': patch
---

A non-modal `Popover` now closes when Tab leaves its panel. Tab from the last element goes to the element after the trigger, and Shift+Tab from the first goes back to the trigger. The panel sits at the end of the page, so Tab used to leave the document and the popover stayed open.
