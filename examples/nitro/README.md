# Nitro example

A brumate app that [Nitro](https://nitro.build) serves and builds.

- `pnpm dev` runs it with Vite and Nitro.
- `pnpm build` writes `.output`, for Node by default. `NITRO_PRESET=cloudflare-module pnpm build` builds for another host.
- `node .output/server/index.mjs` serves the build.
- `pnpm test` builds the app, runs it, and posts a form to it.

`src/entry-server.ts` answers each request. `vite.config.ts` names the client entry.
