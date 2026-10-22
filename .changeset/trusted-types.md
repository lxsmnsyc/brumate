---
'brumate': patch
---

The core works on a site whose Content Security Policy has `require-trusted-types-for 'script'`. It makes a Trusted Types policy named `brumate`, once, when it first inserts markup, and passes the markup that it renders and the scripts of `#defer` bodies and of pages that the client router loads through it. Allow it with `trusted-types brumate`.
