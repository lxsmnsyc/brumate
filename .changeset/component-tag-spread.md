---
'brumate': patch
---

A live spread (`<{as} {...rest}>`) or a computed attribute (`<{as} [name]=(value)>`) on a dynamic tag that names a component now reaches the component when its value changes. Before, the component kept the props of the server render. A computed attribute whose name or value can change on a plain element or a dynamic tag no longer fails to compile with "This attribute cannot change on the client yet".
