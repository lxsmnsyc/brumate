---
'brumate': minor
---

`$provide` is now `$setContext`, and `$context` is now `$getContext`. They take the same arguments as before.

An import or a call of `$provide` or `$context` is a compile error that names the new function, such as `$provide was renamed to $setContext`.
