---
'brumate': minor
---

The devtools show much more of what a page does, and errors show there in place of Vite's overlay.

- **Errors** lists errors of the server, of Vite and of the browser, including handlers that no `#try` catches. The selected error shows its file highlighted, with the place marked, and its stack, whose browser frames map to their files and lines. `errorPage` opens the devtools on the error.
- **Elements** shows a picked element with its place in the `.brm` file, its handlers and the values that its updates read. A card follows the pointer while picking.
- **Loading** lists each part of client code that loaded, with why, how long it took and its size, and marks preloads that nothing used.
- **Page state** lists each value that the page sent, with about how many bytes it takes and the code of the browser that reads it.
- **Effects** counts the runs and cleanups of each `$effect` and `$client` callback, and marks one that runs too often.
- **Timeline** shows each handler with its server calls and updates, and **Server** shows what the dev server did for the page: its render, its memos, its calls and its `#loading` bodies.
- **Navigation** shows the routes that each client navigation kept and replaced.
- **Blocks** lists the `#loading`, `#defer` and `#client` blocks, fires a trigger now, and shows the fallback of a body again.
- The page can outline the elements that change. The button shows the logo of brumate and the number of errors.
- `brumate/highlight` exports the twinkleplop language of `.brm` files.
