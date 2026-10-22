---
'brumate': minor
---

`defineEnv` from `brumate/env` declares the environment variables of the app in `src/env.ts`, with a Standard Schema for each, split into server and public values. The server checks them when it starts, and fails with every missing or wrong one. The browser gets the file without the server schemas, with the values of the public variables written in. Only components import the file in code that the browser loads. The compiler reports a read of a server variable in code that runs in the browser, and a value made from one that the page state would send. The server refuses to send a page whose state holds the value of a server variable, and the error at start does not print one. The `env` option of the plugin names another file, or `false` uses none.
