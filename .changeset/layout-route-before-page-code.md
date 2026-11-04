---
'brumate': patch
---

A layout that stays on a client navigation and reads `$route()` now updates in the same frame as the new page. Before, its update waited for the code of the new page to load, so the layout showed the old route for a moment. An update now waits only for the code of the components at its scope and above it.
