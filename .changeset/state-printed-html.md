---
'brumate': minor
---

- The page state leaves out raw HTML of 256 characters or more that the page printed in a flow element such as a `<div>`. The browser reads it back from the page while it parses, so navigation responses of the website are 17 to 20% smaller gzipped.
- Raw HTML in an `<a>`, a `<p>`, a `<button>`, a list item, a table, a `<template>` or a `#head` body stays in the state.
- So does raw HTML that the parser would change, such as an unclosed element, a `<script>` or a `<pre>` that starts with a newline.
- A render in order, which crawlers get, keeps every value in the state.
- The markers come from the route, so a static build gives the same pages each time.
- An app with no insert where raw HTML can print this way gets no reader in its client code.
