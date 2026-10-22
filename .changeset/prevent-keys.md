---
'brumate': minor
---

`:prevent` of a keyboard event can name the keys to prevent, such as `onKeyDown:prevent(ArrowDown ArrowUp Enter)`. The loader prevents only those keys, before the handler's code loads, and the handler still runs for every key. A modifier on a component is now a compile error, since nothing applied it.
