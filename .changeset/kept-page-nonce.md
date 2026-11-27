---
'brumate': patch
---

- A page kept by `cache` gets the `nonce` of the request it is served to on every `nonce` attribute. It gets none when the request has none.
- A page that holds its nonce in a meta policy, in script text or in a header is rendered again for each request.
