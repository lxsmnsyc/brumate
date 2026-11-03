# Outcome: llms-txt

## Built

- `website/plugins/llms.ts`: a Vite plugin (`llms(origin)`) and the functions `readPages`, `toMarkdown`, `llmsTxt` and `llmsFull`. The client build writes `/llms.txt`, `/llms-full.txt` and the Markdown of each page: `/docs/<page>.md` (the first page is `/docs/index.md`) and `/ui/<part>.md`. The dev server serves the same paths. The server build writes nothing.
- The Markdown of a page is its source file, with demos written out as their `.brm` source, `props X` blocks as Markdown tables (from `readProps`), anatomy blocks as numbered lists, gallery blocks dropped, and links to other pages pointed at their `.md` path.
- `website/src/components/CopyMarkdown.brm`: a plain button, "Copy Markdown" then "Copied", that copies the `.md` of the page with `navigator.clipboard.write` and a `ClipboardItem` holding the fetch promise. It uses site tokens, mono type, and no extra label.
- `website/test/llms.test.ts`: 7 tests. Every docs page and every ui page file is listed in llms.txt, the title and summary, no site-only block left, a demo and a props table are written out, links point at `.md`, and llms-full holds every page.

## Deviations

- `website/src/components/DocPage.brm` (not owned): one import and one line that mounts `<CopyMarkdown>` above the eyebrow. Needed for the button to appear on every docs and ui page.
- The order of pages in llms.txt is the order of file names (first page leads), not the sidebar groups, because `src/docs.ts` and `src/ui.ts` use `import.meta.glob` and cannot load in Node.
- `/ui` (the landing page) is a route with no Markdown file, so it has no `.md`.

## Stubs left

- None.

## Gotchas

- The test imports `plugins/markdown.ts`, which needs `brumate` built (`pnpm build`) in a fresh worktree.
- The dev-server middleware was not run in a browser; the build output was checked.
- `llms.txt` links use `SITE_URL` (or the Vercel domain), falling back to `http://localhost:5180`.

## Proposed learnings

- None.

## Verification

- `pnpm --filter website exec vitest run test/llms.test.ts`: pass (7 tests).
- `pnpm lint`: pass (no errors). `pnpm format:check`: pass. `pnpm typecheck`: pass (after building language-server; it failed once with SIGKILL under load).
- `pnpm --filter website check:samples`: pass (65 samples). `pnpm --filter website build`: pass; dist/client has llms.txt, llms-full.txt, docs/*.md, ui/*.md.

## Size

- Estimated M, actual M.
