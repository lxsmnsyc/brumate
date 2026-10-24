---
'brumate': patch
---

The attributes of a dynamic tag with a spread merge as those of an element do: a `class` of the spread adds to the class of the tag, such as `<{as ?? 'button'} class="part" {...rest}>` with a `class` in `rest`. Before, the class of the spread replaced it.
