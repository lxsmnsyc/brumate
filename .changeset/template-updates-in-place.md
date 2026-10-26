---
'brumate': patch
---

A `#template` that a component calls again at the same place with new arguments, such as for an item of a list whose object changes, now updates its markup in place, as a snippet of Svelte does. Before, it rendered again, so its elements were new and lost focus.
