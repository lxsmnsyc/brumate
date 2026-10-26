---
'brumate': patch
---

Children that a component passes on to another, as `<Select>{children}</Select>`, now read the contexts of the component that inserts them. Before, they read the contexts around the component that passed them on, so a part inside them found no Select.
