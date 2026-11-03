# Log

- Nothing existed (no llms plugin, no test). Wrote website/plugins/llms.ts (pages, llms.txt, llms-full.txt, .md per page; dev middleware), registered in vite.config.ts.
- CopyMarkdown.brm added; mounted in DocPage.brm (not an owned path, one import and one line).
- Test needs built brumate (pnpm build) in a fresh worktree; language-server build failed once under load, passed alone.
