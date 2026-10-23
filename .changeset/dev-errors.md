---
'brumate': patch
---

Errors in development are easier to find.

- A route that does not compile breaks only its own pages. The other pages of the dev server still render.
- The Errors tab of the devtools shows the errors of handlers and updates that no `#try` catches.
- The Errors tab maps the frames of code that the browser ran to their files and lines, such as a function of a module of reactive logic. A frame that no source map covers shows the code that the browser ran.
- The code of an error is highlighted with the whole file, so lines inside a script have their colours.
- A global error shows its own message, without the `Uncaught` that the browser adds.
