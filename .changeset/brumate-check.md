---
'brumate': minor
---

`brumate check [--json] [--no-types] [paths]` compiles every `.brm` file and runs the type checker, and prints each problem with its file, range, message, code and a link to the docs. It exits with 1 on an error. It reads `.brm.ts` modules and `'use server'` files from packages of components, such as `@brumate/ui/data.brm.ts`, the way the vite plugin does.

Each compile error has a stable code such as `BRM012`, shown at the end of its message. `ERRORS` of the error catalog holds the code and the link of each one. The docs list every code at /docs/errors.
