---
'brumate': minor
---

Breaking: new compile error BRM185 for markup that the HTML parser closes or moves before the page runs: a block element such as `<div>` inside a `<p>`, a heading in a heading, an `<li>` in an `<li>`, an `<a>` in an `<a>`, a `<form>` in a `<form>`, a `<button>` in a `<button>`, and an element that a table does not keep. In development, the server render also throws when a component inside a `<p>` renders an element that closes the `<p>`, and names the component and the file. Production renders are unchanged.

The "Missing end marker" error of the browser render names this cause.
