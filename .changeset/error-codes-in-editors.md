---
'@brumate/language-server': patch
'@brumate/tsc': patch
---

- The language server gives each compile error its code, such as `BRM012`, and a link to the page that explains it.
- `brumate-tsc` prints the code of each compile error, such as `error BRM012`, in place of `error BRM`.
