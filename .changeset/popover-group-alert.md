---
'@brumate/ui': minor
---

- `PopoverGroup` keeps non-modal popovers open while focus moves between them. Inside it, focus on the trigger or the panel of another popover of the group closes none, and `Tab` from the end of a panel goes to the next element after its trigger.
- `Alert` is a `<div role="alert">` with no state.
