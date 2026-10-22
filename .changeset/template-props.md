---
'brumate': minor
---

A `#template` passed as a prop renders in the browser, such as a list item whose selection changes. It used to fail the render. The template keeps reading the values of the component that wrote it.
