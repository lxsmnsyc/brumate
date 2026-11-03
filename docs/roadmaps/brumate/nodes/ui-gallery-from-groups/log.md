# Log: ui-gallery-from-groups

- 2026-11-03: Cards in `description`? No: it is the first paragraph (long), the cards need short text. Added a `summary` field in front matter instead.
- No page had front matter. Added `website/plugins/front-matter.ts`; markdown.ts, llms.ts and search.ts strip it.
- `demo` is not in the front matter: the landing cards show no demo, so it was unused once the fence went.
- Moved `groups` to `website/src/ui-groups.ts` so a Node test can import it (ui.ts uses import.meta.glob).
- Worktree needed `pnpm build` at the root before check:samples and the tests.
