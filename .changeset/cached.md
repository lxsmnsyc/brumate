---
'brumate': minor
---

`cached(fn, { maxAge, tags })` from `brumate/server` keeps the results of a function by its arguments, so requests share them, and `revalidate(...tags)` drops them. The function runs without the request, so a result never holds one user's data. Results live in memory by default, and `setCacheStore(storageStore(storage))` keeps them in an unstorage storage, such as Redis through Nitro. A `'use server'` file can export a function that `cached` makes.
