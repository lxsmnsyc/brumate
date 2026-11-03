---
'brumate': minor
---

A promise in markup renders the value that it settles to, in text and in attribute values, such as `<p title=getTitle()>{Promise.resolve('hello world')}</p>`. A pending promise makes the nearest `#loading` pending: the block shows its `#else` until the promise settles, the server streams the body then, and sends each element with its final attributes. Outside every `#loading`, the server waits for the promise. A spread follows the attribute rule. In the browser, the boundary counts the promise as a wait, an update keeps what shows until the new promise settles, the latest promise wins, and a rejection goes to the nearest `#catch`. A `#loading` body whose text or attributes call code now always streams from the server, since the call can give a promise. A promise that the compiler sees in an event handler, the key of a `#for`, `ref` or `$bind` is a compile error, BRM188.
