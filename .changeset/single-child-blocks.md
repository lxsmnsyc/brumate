---
'brumate': minor
---

A block body can be one markup child without braces: `#if (user) <Profile {user} /> #else <SignIn />`, `#for (item of items by item.id) <Row {item} />`, `#try <A /> #catch (error, reset) <B {error} {reset} />`. The child is one element, component, dynamic tag, fragment or block. Text and `{expression}` still need braces, since `{` after a block header always opens a body. The error BRM044 now names both forms.
