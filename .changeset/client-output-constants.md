---
'brumate': patch
---

The client code is a little smaller and does less work on each update. A bundle holds each component as a plain object of its exports, without a getter for each one, and the constants of updates, such as the key function of a list, are made once per module.
