---
'brumate': minor
---

Skew protection. Each build has an ID, which the client build writes to `.brumate/build.json` and the server build reads, or `BRUMATE_BUILD` in the environment names for both. The page state carries it, and the browser sends it with each server function call and each request for a `#defer` body. A call from a page of another build to a function that is gone answers 409, and the browser loads the next page in full, loads the page again at once when the code of a handler is gone, and posts a form of `$action` again without scripts. Client navigation loads a page of another build in full. The page gets a `brumate:skew` event first. `skew: { keep }` in the plugin keeps the files of earlier builds in the client output.
