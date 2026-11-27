---
'brumate': patch
---

- The body of a `#defer` block keeps the rules of its block `<style>` after a client navigation. The request for the body sends the style of the component that holds the block, because navigation removes a stylesheet that no element uses while only the fallback shows.
- The `#defer` bodies that a prerendered page fills in its own response wait for their stylesheets before they swap in, as the bodies of a request do. The `#loading` bodies wait for the stylesheets that their markup links too.
