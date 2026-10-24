---
'brumate': patch
---

- An element with several spreads keeps the attributes of each when one of them changes in the browser. Before, an update of one spread removed the attributes of the others, such as the `class` of a rest prop.
- A dynamic tag keeps the element that the server rendered when its scope updates after the page resumed, such as markup that streams in after an event. Before, it rendered the element again, and lost its focus and its handlers' state.
- A memo of an object literal, such as `$memo({ title })`, compiles in the browser. Before, the arrow read the object as a block.
