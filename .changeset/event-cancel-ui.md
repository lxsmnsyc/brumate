---
'@brumate/ui': patch
---

A pending submit Button cancels its form's submit with `cancelWhen`, and no longer adds a listener to the window.

A plain `submit` listener of the page now runs while the button is pending, and must read `event.defaultPrevented`. The default action is still prevented.
