# Log: template-fragment-return

- The batch branch lacks this node's folder (brief.md lives on main, f289a594). Read it with `git show`; not copied.
- Base a09f674e: `pnpm bench --only brumate --scenario todos`: JS before `load` 35.3 kB / 14.6 kB gzip (5 files).
- Base scope count of `tplInPlaceHost` keyed list: 11 (from the clone-remaining-bodies outcome; the resume test compares the count before and after).
- Codegen return done; first try left tplInPlaceHost 14 vs 11. Fix: templateNodes WeakMap read by destroyNodes and inRange. Then `$$k0` missing in withTemplates parts: shareConstant. resume 670 pass.
- After: todos 35.4 kB / 14.6 kB gzip. UI vitest, e2e ui (61), browser-async (6) pass.
