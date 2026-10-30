---
'brumate': minor
---

A `#for` takes `window(height, count)`, which renders only the items in view. The server renders the first items, with spacers for the height of the rest, and the browser renders the items that come into view as the user scrolls. Items that leave the view keep their state while they are in the list. A windowed list keeps its `#else` body for an empty list only, and takes the element that can scroll vertically as its scroller.
