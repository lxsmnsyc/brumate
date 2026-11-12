---
'brumate': patch
---

Component `<style>` elements carry the `nonce` of the render, and styles that the browser adds copy the page nonce, so `style-src 'nonce-…'` loads them.
