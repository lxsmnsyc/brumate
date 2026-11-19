---
'brumate': minor
---

In a build, the CSS of components goes through Vite's CSS pipeline into `.css` assets, one per route bundle plus shared chunks, and no `$$css` string is left in the JavaScript. The project's PostCSS config or Lightning CSS now runs on component styles, in builds and in dev. The server writes the CSS of the components a page renders as `<style>` elements in render order, so rule order is the same on every page and no first paint waits for a stylesheet. The bundle sheets load without blocking, a client navigation or a `#defer` body waits for the next stylesheets before it shows, and the server links the stylesheets of a component rendered outside the routes. In dev and with a relative `base`, the CSS stays inline.
