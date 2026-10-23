---
'brumate': minor
---

Errors show in the devtools, in place of Vite's overlay:

- An **Errors** tab lists errors of a render on the server, of Vite, such as a compile error after an edit, and of code in the browser.
- The selected error shows the lines of its file highlighted, with the line and the word at its column marked, and its stack. A place of the stack shows its code.
- `errorPage` opens the devtools on the error, and falls back to Vite's overlay.
- The devtools button shows the logo of brumate, with the number of errors.
- `brumate/highlight` exports the twinkleplop language of `.brm` files.
