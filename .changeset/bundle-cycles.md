---
'brumate': patch
---

A build gives client code to components that only import each other, such as a Tree and a Leaf that render each other. Before, they had no bundle, and their handlers did nothing. A spread that writes no attribute on the server now keeps the attributes that other code sets, on its first update in the browser.
