# Log: template-import-render

- 2026-11-03: Reproduced. componentNames (codegen/render.ts) read `children` of block bodies but not `body.templates`; only top-level `file.templates` were read.
- Failing test first: six cases failed with `TryKid is not defined` or a missing import (#try, #if, #key, #for, #loading, #switch). A template at the top level passed.
- Fix: bodyNames() reads the children and the templates of every body, nested templates included.
