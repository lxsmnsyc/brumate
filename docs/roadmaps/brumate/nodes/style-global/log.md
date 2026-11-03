# Log: style-global

- Probed: `<style>` in a block already fails with BRM011, so `<style global>` in a block needed no new check.
- Added `global` to the `Style` AST, parsed in parser.ts; css.ts skips scoping and targets for it and only unwraps `:global(...)`.
- New codes BRM189 (unknown `<style>` attribute) and BRM190 (`global` with a value).
- Worktree had no install; ran `pnpm install --offline` and `pnpm build` before typecheck.
