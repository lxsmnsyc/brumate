# brumate website

The documentation of brumate, built with brumate itself.

- The pages are routes in [`src/routes`](./src/routes). The build renders each one to a static HTML file with the `prerender` option of the brumate plugin, so the site needs no server.
- [`docs/`](./docs) holds the pages of the documentation. [`plugins/markdown.ts`](./plugins/markdown.ts) renders them, and [`src/docs.ts`](./src/docs.ts) orders them in the sidebar.
- A code block marked `brm live` is a sample that runs in the page. The compiler and the server runtime run in the browser, and the core of the site resumes the sample. See [`src/live/run.ts`](./src/live/run.ts). `pnpm --filter website check:samples` compiles every sample and fails on errors and warnings.
- The demos on the home page are brumate components. A small inline script lists the scripts that the page loads, so a visitor sees each chunk arrive when they use a demo.
- [`plugins/showcase.ts`](./plugins/showcase.ts) runs `inspect` on the demos at build time, so the tables of what ships come from the compiler that builds the site.
- Code is highlighted with twinkleplop at build time. [`src/highlight/brm.ts`](./src/highlight/brm.ts) is the language for `.brm` files.

Run it from the root of the repository:

```bash
pnpm install
pnpm build
pnpm --filter website dev
```

`pnpm --filter website build` writes the static site to `dist/client`, and `pnpm --filter website preview` serves it. Set `BASE` when the site is served from a subpath, as in `BASE=/brumate/ pnpm --filter website build`.
