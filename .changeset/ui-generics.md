---
'@brumate/ui': minor
---

Type parameters for the values of the parts. ListBox, GridList, Table, TableBody, Tree, TreeRow and NavigationTree take a type `V` for their items, so `item` and `getTextValue` get the type of `items` and a wrong field is an error. ToastRegion takes `V` for the content of a toast. The props types take the value first, then the target: `ListBoxProps<V, T>`.
