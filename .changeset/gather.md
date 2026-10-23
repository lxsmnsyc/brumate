---
'brumate': minor
---

`gather(stream, { key })` from `brumate/stream` gives the list of a stream's values so far, so a memo of it renders a list that grows with `#for`, such as the tokens of a reply. A value with a key that came before updates its item. The server renders the empty list without starting the stream, and the list fills in the browser.
