---
'brumate': patch
---

Calls of the functions of other components, such as function props and provided functions, start in the order that they were made. The code of each still loads in parallel. Before, a call whose code loaded sooner could run first, such as the `onKeyDown` of an Enter before the `onChange` of the text typed before it.
