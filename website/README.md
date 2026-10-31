# brumate website

The documentation of brumate, built with brumate itself.

- The pages are routes in [`src/routes`](./src/routes). The build renders each one to a static HTML file with the `prerender` option of the brumate plugin, so the site needs no server.
- [`docs/`](./docs) holds the Markdown pages of the brumate documentation. [`plugins/markdown.ts`](./plugins/markdown.ts) renders them, and [`src/docs.ts`](./src/docs.ts) orders them in the sidebar.
- [`ui/`](./ui) holds the Markdown pages of the `@brumate/ui` section, one for each part, and `ui/demos` holds their demos as `.brm` files. [`src/ui.ts`](./src/ui.ts) loads the pages and the demos, and [`src/ui-landing.ts`](./src/ui-landing.ts) holds the code samples and measured sizes of the landing page of the section.
- [`plugins/props-table.ts`](./plugins/props-table.ts) reads the props of a part from its `.brm` file in `packages/ui/src`, for the props tables of the `ui/` pages.
- [`plugins/search.ts`](./plugins/search.ts) builds the search index of the documentation (`virtual:search-index`) and the one of the `@brumate/ui` pages (`virtual:ui-search-index`). The command bar of the header, [`src/components/Search.brm`](./src/components/Search.brm), loads both when it first opens. ⌘K, Ctrl+K and `/` open it.
- [`scripts/measure-ui-sizes.mjs`](./scripts/measure-ui-sizes.mjs) measures the gzipped `.js` that a page loads for a part of `@brumate/ui`. Run it from this folder with `node scripts/measure-ui-sizes.mjs`.
- A code block marked `brm live` is a sample that runs in the page. The compiler and the server runtime run in the browser, and the core of the site resumes the sample. See [`src/live/run.ts`](./src/live/run.ts). `pnpm --filter website check:samples` compiles every sample and fails on errors and warnings.
- The demos on the home page are brumate components. A small inline script lists the scripts that the page loads, in the strip at the bottom of the home page and in the footer of every page.
- [`plugins/showcase.ts`](./plugins/showcase.ts) runs `inspect` and `compile` on a demo at build time, and renders it on the server, so the code, the HTML, the state and the sizes on the home page come from the compiler and runtime that build the site.
- [`DESIGN.md`](./DESIGN.md) is the design language of the site: its tokens, type, motion and shared classes.
- Code is highlighted with twinkleplop at build time. [`src/highlight/brm.ts`](./src/highlight/brm.ts) is the language for `.brm` files.

Run it from the root of the repository:

```bash
pnpm install
pnpm build
pnpm --filter website dev
```

`pnpm --filter website build` writes the static site to `dist/client`, and `pnpm --filter website preview` serves it. Set `BASE` when the site is served from a subpath, as in `BASE=/brumate/ pnpm --filter website build`.
