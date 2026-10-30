---
'brumate': minor
---

Breaking: the attribute that scopes the styles of a component is `b-c-<hash>`, in place of `s-<hash>`. It is under the reserved `b-` prefix, so markup and data from outside the app cannot write it. CSS that names the old attribute, such as `[s-1abc]`, needs the new name.
