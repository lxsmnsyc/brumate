---
'brumate': patch
---

The Vite plugin reads and compiles the components 32 at a time, instead of all at once. A project with hundreds of components no longer fails a build with `EMFILE: too many open files`.
