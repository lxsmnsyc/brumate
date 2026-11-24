---
'brumate': minor
---

- In a build, component CSS goes through Vite's CSS pipeline into `.css` assets, one per route bundle plus shared chunks. No `$$css` string is left in the `.js` output.
- The project's PostCSS config or Lightning CSS runs on component styles, in builds and in dev.
- The server writes the CSS of the components a page renders as `<style>` elements in render order. Rule order is the same on every page, and no first paint waits for a stylesheet.
- Bundle stylesheets load without blocking. A client navigation or a `#defer` body waits for its stylesheets before it shows.
- The server links the stylesheets of a component rendered outside the routes.
- In dev and with a relative `base`, the CSS stays inline.
