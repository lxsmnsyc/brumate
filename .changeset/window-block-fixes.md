---
'brumate': patch
---

A windowed `#for` list keeps its `#else` body for an empty list only, keys its items by their index in the whole list, keeps updating inside an item that is out of the page for a while, draws again when its scroller changes size, and takes the element that can scroll vertically as its scroller.
