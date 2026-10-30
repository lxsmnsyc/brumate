---
'brumate': patch
---

`brumate check` reads `.brm.ts` modules and `'use server'` files from packages of components, such as `@brumate/ui/data.brm.ts`, the way the vite plugin does. It no longer reports BRM167 for a file that builds.
