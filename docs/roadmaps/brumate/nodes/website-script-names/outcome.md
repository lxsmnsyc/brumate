# Outcome: website-script-names

## Built

- `scriptNames` in website/vite.config.ts writes the map to `dist/client/script-names-<hash>.json` and returns a `<link rel="script-names" href>` for the head. The inline `window.__scriptNames` script is gone from every page.
- NETWORK_SCRIPT in website/src/scripts.ts keeps the file name of each request and resolves its readable name when it renders. When a panel with a visible list renders (the home strip) and the map is not loaded, it fetches the linked file once, sets `window.__scriptNames` and renders again. The footer meter lists are hidden, so pages without a strip never fetch the file.
- `base` in the config is a constant now, used by `defineConfig` and the link.

## Deviations

None. Only the two shared files and this folder changed.

## Stubs left

None.

## Gotchas

- Every page has a `data-network` panel (the footer meter), but its list is `hidden`, so "has a panel" is read as "shows the list".
- The `head` callback writes the file itself, using `dist/client` as the prerender step does. If the client output directory changes, change it in both places.
- Until the map loads, the strip shows hashed file names for a moment, then the readable ones.
- Navigating back to the home page in the same session shows "Nothing new", as before.

## Proposed learnings

- Data that only one widget reads belongs in a content-hashed file, not in the head of every page.

## Verification

- `pnpm lint` (warnings only, none in the changed files), `pnpm format:check`, `pnpm --filter website typecheck` and `pnpm --filter website test` (261 tests) pass. Root `pnpm typecheck` fails in packages/vscode on a missing `@brumate/language-server` build, which this branch does not touch.
- Chrome on `pnpm preview`: the home strip shows the map names (531 entries); /docs makes no request for the map; a client navigation from a cold /docs to / fetches it and the strip shows names.

## Size

Home page HTML (website/dist/client/index.html):

| | raw | gzip -9 |
| --- | --- | --- |
| before | 126862 B | 30640 B |
| after | 95207 B | 20035 B |

The JSON file is fetched only where a list is shown.
