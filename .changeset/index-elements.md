---
'brumate': patch
---

The first click on a page with a long list from the server runs faster. The bound elements of the page are indexed with its markers, so each update finds its element without a search of the page, and each handler of a list preloads once instead of once for each row.
