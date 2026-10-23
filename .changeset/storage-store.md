---
'brumate': patch
---

`storageStore` reads and writes the raw values of an unstorage storage, since `getItem` parses text that looks like JSON. The Nitro example keeps its list of notes with `cached`, its page with `cache`, and both in Nitro's storage.
