---
'brumate': patch
---

Vitest no longer keeps `.brm` files in its file cache. A component's code depends on the `.brm.ts` modules it calls, and a cached component could call a function of an old version of a module, such as `s1030 is not a function`.
