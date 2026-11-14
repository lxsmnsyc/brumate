---
'brumate': patch
---

Client navigation and the devtools work under `require-trusted-types-for 'script'`. Navigation parsed the next page with `DOMParser` and `document.write` outside the `brumate` policy, so the browser refused it and every link fell back to a full load. The devtools set icons and highlighted code with plain strings. A second copy of the core, or the core after a hot update, now reuses the policy, since the browser refuses a second policy named `brumate` unless the site allows duplicates.
