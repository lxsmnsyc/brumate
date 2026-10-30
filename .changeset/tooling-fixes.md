---
'brumate': patch
---

- The Vite plugin reads and compiles the components 32 at a time. A project with hundreds of components no longer fails a build with `EMFILE: too many open files`.
- Vitest no longer keeps `.brm` files in its file cache, so a cached component no longer calls a function of an old version of a module.
- The highlighter marks `#reveal` and `#defer` as blocks.
