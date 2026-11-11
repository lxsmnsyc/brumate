---
'brumate': minor
---

- On the dev server, the plugin sets up hot updates and the devtools for a client entry that calls `start` from `brumate/loader`, so the entry only calls `start({ load })`. `devtools: false` turns the devtools off for it too, and a build ships none of it.
